import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiDashboardComponent } from './ui-dashboard';

describe('UiDashboardComponent', () => {
  let component: UiDashboardComponent;
  let fixture: ComponentFixture<UiDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiDashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UiDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
