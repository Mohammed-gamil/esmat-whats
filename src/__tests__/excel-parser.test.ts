import * as XLSX from 'xlsx';
import { parseExcelBuffer, parseFileBuffer, parseCsv } from '@/lib/csv-parser';

describe('Format-Aware File Parsing (CSV & XLSX)', () => {
  it('should parse CSV content properly with parseCsv', () => {
    const csvContent = `name,phone,result\nAlice,+12025550199,Passed\nBob,+14155550188,Distinction`;
    const res = parseCsv(csvContent, 'test.csv');

    expect(res.fileType).toBe('csv');
    expect(res.headers).toEqual(['name', 'phone', 'result']);
    expect(res.recipientColumn).toBe('phone');
    expect(res.rows.length).toBe(2);
    expect(res.rows[0].name).toBe('Alice');
    expect(res.rows[0].phone).toBe('+12025550199');
    expect(res.rows[0].result).toBe('Passed');
  });

  it('should create an Excel workbook buffer and parse .xlsx using parseExcelBuffer', () => {
    // Generate an in-memory XLSX workbook using SheetJS
    const data = [
      ['full_name', 'mobile_number', 'course_name', 'status'],
      ['Sarah Connor', '+12025550143', 'Cybersecurity', 'Approved'],
      ['John Connor', '+14155550177', 'Robotics', 'Pending'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prospects');

    const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const res = parseExcelBuffer(excelBuffer, 'students.xlsx');

    expect(res.fileType).toBe('xlsx');
    expect(res.headers).toEqual(['full_name', 'mobile_number', 'course_name', 'status']);
    expect(res.recipientColumn).toBe('mobile_number');
    expect(res.rows.length).toBe(2);
    expect(res.rows[0].full_name).toBe('Sarah Connor');
    expect(res.rows[0].mobile_number).toBe('+12025550143');
    expect(res.rows[1].full_name).toBe('John Connor');
    expect(res.rows[1].status).toBe('Pending');
    expect(res.availableSheets).toEqual(['Prospects']);
    expect(res.selectedSheet).toBe('Prospects');
  });

  it('should support multi-sheet Excel workbooks and allow selecting specific sheet', () => {
    const sheet1Data = [
      ['name', 'email'],
      ['Alice', 'alice@example.com'],
    ];
    const sheet2Data = [
      ['client_name', 'phone_number', 'plan'],
      ['TechCorp', '+18005550199', 'Enterprise'],
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws1, 'Leads');
    XLSX.utils.book_append_sheet(workbook, ws2, 'EnterpriseClients');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    // Test sheet 2 explicit selection
    const resSheet2 = parseFileBuffer(buffer, 'clients.xlsx', 'EnterpriseClients');

    expect(resSheet2.availableSheets).toEqual(['Leads', 'EnterpriseClients']);
    expect(resSheet2.selectedSheet).toBe('EnterpriseClients');
    expect(resSheet2.headers).toEqual(['client_name', 'phone_number', 'plan']);
    expect(resSheet2.recipientColumn).toBe('phone_number');
    expect(resSheet2.rows[0].client_name).toBe('TechCorp');
  });
});
