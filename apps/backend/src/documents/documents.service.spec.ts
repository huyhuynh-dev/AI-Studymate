import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service.js';
import { StorageService } from '../storage/storage.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { DocumentsQueueService } from './services/documents-queue.service.js';

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: StorageService,
          useValue: {},
        },
        {
          provide: DocumentsRepoService,
          useValue: {},
        },
        {
          provide: ConversationsRepoService,
          useValue: {},
        },
        {
          provide: DocumentsQueueService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
