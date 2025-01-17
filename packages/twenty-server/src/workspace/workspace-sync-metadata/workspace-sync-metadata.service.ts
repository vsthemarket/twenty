import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { WorkspaceSyncContext } from 'src/workspace/workspace-sync-metadata/interfaces/workspace-sync-context.interface';

import { WorkspaceMigrationRunnerService } from 'src/workspace/workspace-migration-runner/workspace-migration-runner.service';
import { FeatureFlagFactory } from 'src/workspace/workspace-sync-metadata/factories/feature-flags.factory';
import { WorkspaceSyncObjectMetadataService } from 'src/workspace/workspace-sync-metadata/services/workspace-sync-object-metadata.service';
import { WorkspaceSyncRelationMetadataService } from 'src/workspace/workspace-sync-metadata/services/workspace-sync-relation-metadata.service';
import { WorkspaceSyncStorage } from 'src/workspace/workspace-sync-metadata/storage/workspace-sync.storage';
import { WorkspaceLogsService } from 'src/workspace/workspace-sync-metadata/services/workspace-logs.service';

@Injectable()
export class WorkspaceSyncMetadataService {
  private readonly logger = new Logger(WorkspaceSyncMetadataService.name);

  constructor(
    @InjectDataSource('metadata')
    private readonly metadataDataSource: DataSource,
    private readonly featureFlagFactory: FeatureFlagFactory,
    private readonly workspaceMigrationRunnerService: WorkspaceMigrationRunnerService,
    private readonly workspaceSyncObjectMetadataService: WorkspaceSyncObjectMetadataService,
    private readonly workspaceSyncRelationMetadataService: WorkspaceSyncRelationMetadataService,
    private readonly workspaceLogsService: WorkspaceLogsService,
  ) {}

  /**
   *
   * Sync all standard objects and fields metadata for a given workspace and data source
   * This will update the metadata if it has changed and generate migrations based on the diff.
   *
   * @param dataSourceId
   * @param workspaceId
   */
  public async syncStandardObjectsAndFieldsMetadata(
    context: WorkspaceSyncContext,
    options?: { dryRun?: boolean },
  ) {
    this.logger.log('Syncing standard objects and fields metadata');
    const queryRunner = this.metadataDataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    const manager = queryRunner.manager;

    try {
      const storage = new WorkspaceSyncStorage();

      // Retrieve feature flags
      const workspaceFeatureFlagsMap =
        await this.featureFlagFactory.create(context);

      this.logger.log('Syncing standard objects and fields metadata');

      const workspaceObjectMigrations =
        await this.workspaceSyncObjectMetadataService.synchronize(
          context,
          manager,
          storage,
          workspaceFeatureFlagsMap,
        );

      const workspaceRelationMigrations =
        await this.workspaceSyncRelationMetadataService.synchronize(
          context,
          manager,
          storage,
          workspaceFeatureFlagsMap,
        );

      // If we're running a dry run, rollback the transaction and do not execute migrations
      if (options?.dryRun) {
        const workspaceMigrations = [
          ...workspaceObjectMigrations,
          ...workspaceRelationMigrations,
        ];

        this.logger.log('Running in dry run mode, rolling back transaction');

        await queryRunner.rollbackTransaction();

        await this.workspaceLogsService.saveLogs(storage, workspaceMigrations);

        return;
      }

      await queryRunner.commitTransaction();

      // Execute migrations
      await this.workspaceMigrationRunnerService.executeMigrationFromPendingMigrations(
        context.workspaceId,
      );
    } catch (error) {
      console.error('Sync of standard objects failed with:', error);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }
}
