import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('feature_flags')
export class FeatureFlag {
    @PrimaryColumn()
    key: string;

    @Column({ default: false })
    enabled: boolean;

    @Column({ nullable: true })
    description: string;

    @Column({ type: 'json', nullable: true })
    environmentDefaults: Record<string, boolean>;

    @Column({ type: 'json', nullable: true })
    userOverrides: Record<string, boolean>;

    @Column({ type: 'float', nullable: true })
    rolloutPercentage: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
