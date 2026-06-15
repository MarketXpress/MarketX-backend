import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Category } from './entities/category.entity';

type CreateCategoryDto = {
  name: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
  parentId?: number | null;
};

type CategoryNode = Category & { children: CategoryNode[] };

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  /**
   * Create a category, optionally under a parent.
   * Enforces:
   * - parent exists (if parentId provided)
   * - no self-parenting
   * - no cycles (defensive; mostly important for update/move)
   */
  async create(dto: CreateCategoryDto): Promise<Category> {
    const parentId = dto.parentId ?? null;

    if (parentId !== null) {
      // parent must exist
      const parent = await this.categoryRepo.findOne({
        where: { id: parentId },
      });
      if (!parent) {
        throw new BadRequestException(`Parent category ${parentId} not found`);
      }
    }

    // For create, cycle is unlikely unless you do weird manual IDs,
    // but we keep the guard consistent (especially if later you support client-provided IDs).
    // If you later add UPDATE/move, the same check becomes mandatory.
    // (No check against "id" here because new category doesn't have an id yet.)

    const entity = this.categoryRepo.create({
      name: dto.name.trim(),
      description: dto.description,
      icon: dto.icon,
      isActive: dto.isActive ?? true,
      parentId,
    });

    try {
      return await this.categoryRepo.save(entity);
    } catch (e) {
      // Useful when you enforce unique sibling names via @Index(['parentId','name'], { unique: true })
      if (this.isUniqueViolation(e)) {
        throw new BadRequestException(
          `A category named "${dto.name}" already exists under the selected parent.`,
        );
      }
      throw e;
    }
  }

  /**
   * Returns a nested category tree.
   * Efficient strategy:
   * - Load categories flat (single query)
   * - Build tree in memory (O(n))
   */
  async getTree(): Promise<CategoryNode[]> {
    const categories = await this.categoryRepo.find({
      order: { name: 'ASC' },
      // Don't load relations; we build it ourselves to avoid N+1 queries.
    });

    return this.buildTree(categories);
  }

  /**
   * Get all products belonging to a category.
   * Recommended behavior: include products in descendants too.
   */
  async getProductsByCategory(categoryId: number) {
    // Ticket scope says: dummy for now
    return {
      categoryId,
      includeDescendants: true,
      products: [],
      note: 'Placeholder endpoint. Implement with Products module later.',
    };
  }

  /**
   * Prevent circular relationships for category moves/updates.
   * This is the core rule:
   * - A category cannot be assigned under itself or any of its descendants.
   *
   * Use this method in UPDATE/move endpoints.
   */
  private async assertNoCycle(categoryId: number, newParentId: number | null) {
    if (newParentId === null) return;

    if (newParentId === categoryId) {
      throw new BadRequestException('A category cannot be its own parent.');
    }

    // Walk up the ancestor chain from newParentId; if we hit categoryId, it's a cycle.
    let currentId: number | null = newParentId;
    const visited = new Set<number>();

    while (currentId !== null) {
      if (visited.has(currentId)) {
        // This indicates existing corruption (cycle already present)
        throw new BadRequestException(
          'Category tree is corrupted (cycle detected).',
        );
      }
      visited.add(currentId);

      if (currentId === categoryId) {
        throw new BadRequestException(
          'Circular category relationship is not allowed.',
        );
      }

      const node = await this.categoryRepo.findOne({
        where: { id: currentId },
        select: { id: true, parentId: true },
      });

      if (!node) {
        // parent reference points to non-existing node (corrupted data)
        throw new BadRequestException('Invalid parent reference detected.');
      }

      currentId = node.parentId ?? null;
    }
  }

  /**
   * Build tree (roots with nested children) from a flat list.
   */
  private buildTree(categories: Category[]): CategoryNode[] {
    const byId = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];

    // Initialize nodes
    for (const c of categories) {
      byId.set(c.id, { ...(c as CategoryNode), children: [] });
    }

    // Attach children to parents
    for (const node of byId.values()) {
      const parentId = node.parentId ?? null;

      if (parentId === null) {
        roots.push(node);
        continue;
      }

      const parent = byId.get(parentId);
      if (!parent) {
        // orphaned category (corrupted data) -> treat as root to avoid crashing API
        roots.push(node);
        continue;
      }

      parent.children.push(node);
    }

    return roots;
  }

  /**
   * Returns [categoryId, ...descendants]
   * Efficient for small/medium category trees:
   * - Load all categories once
   * - BFS/DFS in memory
   */
  private async getDescendantCategoryIds(
    categoryId: number,
  ): Promise<number[]> {
    const categories = await this.categoryRepo.find({
      select: { id: true, parentId: true },
    });

    const childrenByParent = new Map<number, number[]>();
    for (const c of categories) {
      const pid = c.parentId ?? null;
      if (pid === null) continue;
      const list = childrenByParent.get(pid) ?? [];
      list.push(c.id);
      childrenByParent.set(pid, list);
    }

    const result: number[] = [];
    const stack: number[] = [categoryId];
    const seen = new Set<number>();

    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);

      const kids = childrenByParent.get(id) ?? [];
      for (const kidId of kids) stack.push(kidId);
    }

    return result;
  }

  private isUniqueViolation(e: any): boolean {
    // Postgres unique violation code is 23505
    return e?.code === '23505';
  }
}
