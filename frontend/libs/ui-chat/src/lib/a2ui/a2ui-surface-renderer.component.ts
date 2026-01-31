import {
  Component,
  input,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { A2UISurfaceFacade } from './a2ui-surface.facade';
import { A2UI_COMPONENT_REGISTRY, A2UI_DEFAULT_COMPONENT } from './a2ui-registry';

/**
 * A2UISurfaceRendererComponent
 * 
 * Responsible for rendering a controllable UI region (Surface).
 */
@Component({
  selector: 'app-a2ui-surface-renderer',
  standalone: true,
  imports: [CommonModule],
  providers: [A2UISurfaceFacade],
  template: `
    <div class="a2ui-surface-container" [class.loading]="facade.isLoading()">
      @if (facade.isLoading()) {
        <div class="a2ui-skeleton">
          <div class="skeleton-rect"></div>
        </div>
      } @else if (facade.error()) {
        <div class="a2ui-error">
          <span class="error-text">{{ facade.error() }}</span>
        </div>
      } @else {
        <div class="a2ui-components">
          @for (comp of facade.surface()?.components; track comp.id) {
            <div class="a2ui-component-wrapper">
               <ng-container 
                 *ngComponentOutlet="getComponentType(comp.component); 
                 inputs: getComponentInputs(comp)"
               />
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .a2ui-surface-container {
      margin: 1rem 0;
      padding: 1rem;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .skeleton-rect {
      height: 100px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }
    .skeleton-rect::after {
      content: "";
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
      animation: shine 2s infinite;
    }
    @keyframes shine {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .a2ui-error {
      color: #ff5252;
      font-size: 0.875rem;
      text-align: center;
      padding: 1rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class A2UISurfaceRendererComponent implements OnDestroy {
  surfaceId = input.required<string>();
  facade = inject(A2UISurfaceFacade);

  constructor() {
    effect(() => {
      const id = this.surfaceId();
      if (id) {
        this.facade.hydrate(id);
      }
    });
  }

  ngOnDestroy() {
    this.facade.destroy();
  }

  getComponentType(type: string): any {
    return A2UI_COMPONENT_REGISTRY[type] || A2UI_DEFAULT_COMPONENT;
  }

  getComponentInputs(comp: any) {
    return {
      surfaceId: this.surfaceId(),
      props: comp.props,
      bindings: comp.bindings,
      dataModel: this.facade.surface()?.dataModel
    };
  }
}
