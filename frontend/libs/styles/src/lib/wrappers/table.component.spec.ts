import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableComponent, ColumnDef } from './table.component';
import { provideZonelessChangeDetection } from '@angular/core';

describe('TableComponent', () => {
  let component: TableComponent;
  let fixture: ComponentFixture<TableComponent>;

  const mockColumns: ColumnDef[] = [
    { key: 'name', header: 'Name', type: 'text' },
    { key: 'price', header: 'Price', type: 'currency' },
    { key: 'change', header: 'Change', type: 'percent' }
  ];

  const mockData = [
    { name: 'AAPL', price: 150.00, change: 0.05 },
    { name: 'GOOGL', price: 2800.00, change: -0.02 },
    { name: 'MSFT', price: 300.00, change: 0.03 }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(TableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render table with data', () => {
    fixture.componentRef.setInput('data', mockData);
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tableElement = compiled.querySelector('table');
    expect(tableElement).toBeTruthy();
  });

  it('should render column headers', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('data', mockData);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const headers = compiled.querySelectorAll('th');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toContain('Name');
    expect(headers[1].textContent).toContain('Price');
    expect(headers[2].textContent).toContain('Change');
  });

  it('should render data rows', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('data', mockData);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(3);
  });

  it('should compute displayedColumns from columns input', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.detectChanges();

    const displayedColumns = component.displayedColumns();
    expect(displayedColumns).toEqual(['name', 'price', 'change']);
  });

  it('should handle empty data array', () => {
    fixture.componentRef.setInput('columns', mockColumns);
    fixture.componentRef.setInput('data', []);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(0);
  });

  it('should have correct CSS class', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const tableElement = compiled.querySelector('.lib-table');
    expect(tableElement).toBeTruthy();
  });
});

