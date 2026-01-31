import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * UISurface Entity
 *
 * Represents a persistent A2UI surface that can be controlled by an agent.
 * Stores the UI structure (components) and the associated data model.
 *
 * Inspired by Google's A2UI (Agent to UI) protocol.
 */
@Entity('ui_surfaces')
@Index(['threadId', 'userId'])
export class UISurface {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  threadId: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * Flat list of A2UI components (adjacency list model).
   * Each component has an ID and references children by ID.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  components: any[];

  /**
   * Shared data model for the surface.
   * Components bind to paths in this object using JSON Pointers.
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  dataModel: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
