import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiCharts } from './ui-charts';

describe('UiCharts', () => {
  let component: UiCharts;
  let fixture: ComponentFixture<UiCharts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiCharts],
    }).compileComponents();

    fixture = TestBed.createComponent(UiCharts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
