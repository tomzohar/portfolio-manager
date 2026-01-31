import { Test, TestingModule } from '@nestjs/testing';
import { A2UICatalogService } from './a2ui-catalog.service';

describe('A2UICatalogService', () => {
  let service: A2UICatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [A2UICatalogService],
    }).compile();

    service = module.get<A2UICatalogService>(A2UICatalogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateComponent', () => {
    it('should validate a correct Text component', () => {
      const component = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        component: 'Text',
        props: {
          text: 'Hello World',
          variant: 'h1',
        },
      };
      expect(() => service.validateComponent(component)).not.toThrow();
    });

    it('should validate a correct Button component', () => {
      const component = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        component: 'Button',
        props: {
          label: 'Click Me',
          action: 'testAction',
        },
      };
      expect(() => service.validateComponent(component)).not.toThrow();
    });

    it('should validate a correct Chart component', () => {
      const component = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        component: 'Chart',
        props: {
          type: 'line',
          title: 'Growth',
        },
        bindings: {
          series: '/data/series',
        },
      };
      expect(() => service.validateComponent(component)).not.toThrow();
    });

    it('should throw error for invalid component type', () => {
      const component = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        component: 'InvalidType',
        props: {},
      };
      expect(() => service.validateComponent(component)).toThrow();
    });

    it('should throw error for missing required props', () => {
      const component = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        component: 'Text',
        props: {}, // Missing 'text'
      };
      expect(() => service.validateComponent(component)).toThrow();
    });

    it('should normalize lowercase component name', () => {
      const component = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        component: 'text', // lowercase
        props: {
          text: 'Hello World',
          variant: 'h1',
        },
      };
      const validated = service.validateComponent(component);
      expect(validated.component).toBe('Text');
    });

    it('should generate ID if missing', () => {
      const component = {
        component: 'Text',
        props: {
          text: 'Hello World',
          variant: 'h1',
        },
      };
      const validated = service.validateComponent(component);
      expect(validated.id).toBeDefined();
      expect(typeof validated.id).toBe('string');
    });
  });
});
