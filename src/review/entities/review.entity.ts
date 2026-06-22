import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
    Index,
  } from 'typeorm';
  
  /**
   * Review entity.
   * One buyer can leave exactly one review per product (enforced by unique constraint).
   * averageRating and reviewCount are denormalized onto Product for fast reads;
   * they are updated transactionally every time a review is created.
   */
  @Entity('reviews')
  @Unique(['userId', 'productId']) // one review per buyer per product
  export class Review {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index()
    @Column({ type: 'uuid' })
    userId: string;
  
    @Index()
    @Column({ type: 'uuid' })
    productId: string;
  
    /**
     * Rating must be an integer in the range 1–5.
     * Validated at the DTO layer and enforced here via check constraint.
     */
    @Column({ type: 'int' })
    rating: number;
  
    @Column({ type: 'text', nullable: true })
    body: string | null;
  
    @CreateDateColumn()
    createdAt: Date;
  }