import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

function makeCategoryRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: 'Electronics',
    isActive: true,
    parentId: null,
    children: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Category;
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: ReturnType<typeof makeCategoryRepo>;

  beforeEach(() => {
    repo = makeCategoryRepo();
    service = new CategoriesService(repo as any);
  });

  // ---------------------------------------------------------------------------
  // create()
  // ---------------------------------------------------------------------------
  describe('create()', () => {
    it('saves and returns the new category', async () => {
      const entity = makeCategory({ name: 'Electronics' });
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create({ name: '  Electronics  ' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Electronics', isActive: true }),
      );
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(entity);
    });

    it('trims whitespace from the name before saving', async () => {
      const entity = makeCategory({ name: 'Clothing' });
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      await service.create({ name: '  Clothing  ' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Clothing' }),
      );
    });

    it('creates a child category when a valid parentId is provided', async () => {
      const parent = makeCategory({ id: 5, name: 'Tech' });
      const child = makeCategory({ id: 10, name: 'Phones', parentId: 5 });
      repo.findOne.mockResolvedValue(parent);
      repo.create.mockReturnValue(child);
      repo.save.mockResolvedValue(child);

      const result = await service.create({ name: 'Phones', parentId: 5 });

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(result.parentId).toBe(5);
    });

    it('throws BadRequestException when parentId does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Sub', parentId: 99 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on duplicate name (unique constraint violation)', async () => {
      repo.create.mockReturnValue(makeCategory());
      repo.save.mockRejectedValue({ code: '23505' });

      await expect(service.create({ name: 'Electronics' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('re-throws non-unique DB errors as-is', async () => {
      const dbError = new Error('connection refused');
      repo.create.mockReturnValue(makeCategory());
      repo.save.mockRejectedValue(dbError);

      await expect(service.create({ name: 'Electronics' })).rejects.toThrow(
        'connection refused',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll()
  // ---------------------------------------------------------------------------
  describe('findAll()', () => {
    it('returns all categories ordered by name', async () => {
      const categories = [
        makeCategory({ id: 2, name: 'Clothing' }),
        makeCategory({ id: 1, name: 'Electronics' }),
      ];
      repo.find.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
      expect(result).toEqual(categories);
    });

    it('returns an empty array when no categories exist', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // remove()
  // ---------------------------------------------------------------------------
  describe('remove()', () => {
    it('deletes a category that has no children', async () => {
      const category = makeCategory({ id: 1, name: 'Empty' });
      repo.findOne.mockResolvedValue(category);
      repo.count.mockResolvedValue(0);
      repo.remove.mockResolvedValue(undefined);

      await service.remove(1);

      expect(repo.count).toHaveBeenCalledWith({ where: { parentId: 1 } });
      expect(repo.remove).toHaveBeenCalledWith(category);
    });

    it('throws BadRequestException when the category has active child categories', async () => {
      repo.findOne.mockResolvedValue(
        makeCategory({ id: 1, name: 'Electronics' }),
      );
      repo.count.mockResolvedValue(3);

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the category does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
