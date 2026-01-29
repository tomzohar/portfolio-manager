import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ConversationApiService } from './conversation-api.service';
import { Conversation } from '@stocks-researcher/types';

describe('ConversationApiService', () => {
    let service: ConversationApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [ConversationApiService],
        });
        service = TestBed.inject(ConversationApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getConversations', () => {
        it('should fetch conversations without limit', () => {
            const mockConversations: Conversation[] = [
                { id: '1', userId: 'u1', config: {}, createdAt: 'date', updatedAt: 'date' },
            ];

            service.getConversations().subscribe((conversations) => {
                expect(conversations).toEqual(mockConversations);
            });

            const req = httpMock.expectOne('http://localhost:3001/api/conversations');
            expect(req.request.method).toBe('GET');
            req.flush(mockConversations);
        });

        it('should fetch conversations with limit', () => {
            const mockConversations: Conversation[] = [
                { id: '1', userId: 'u1', config: {}, createdAt: 'date', updatedAt: 'date' },
            ];
            const limit = 10;

            service.getConversations(limit).subscribe((conversations) => {
                expect(conversations).toEqual(mockConversations);
            });

            const req = httpMock.expectOne((r) => r.url === 'http://localhost:3001/api/conversations' && r.params.get('limit') === '10');
            expect(req.request.method).toBe('GET');
            req.flush(mockConversations);
        });
    });
});
