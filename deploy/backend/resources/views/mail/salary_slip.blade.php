<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Salary Slip – {{ $slipData['period'] }}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a2e; background: #f5f7fa; }
  .wrapper { max-width: 680px; margin: 24px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #102a43 0%, #1e5fae 100%); padding: 28px 32px; color: white; }
  .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
  .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; }
  .slip-meta { background: #1e5fae; padding: 10px 32px; display: flex; gap: 32px; flex-wrap: wrap; }
  .slip-meta span { color: rgba(255,255,255,0.9); font-size: 11.5px; }
  .slip-meta strong { color: white; }
  .body { padding: 28px 32px; }
  .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; margin-top: 22px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .emp-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .emp-field label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
  .emp-field span { font-size: 13px; font-weight: 600; color: #102a43; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f8fafc; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  th.right, td.right { text-align: right; }
  td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
  tr:hover td { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .badge-earning { background: #dcfce7; color: #15803d; }
  .badge-deduction { background: #fee2e2; color: #dc2626; }
  .net-box { background: linear-gradient(135deg, #102a43, #1e5fae); color: white; border-radius: 10px; padding: 20px 24px; margin-top: 20px; }
  .net-box .label { font-size: 11px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
  .net-box .amount { font-size: 28px; font-weight: 700; margin: 4px 0 2px; }
  .net-box .words { font-size: 11px; opacity: 0.75; font-style: italic; }
  .pay-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  .pay-field label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
  .pay-field span { font-size: 13px; font-weight: 600; color: #102a43; }
  .totals-row td { font-weight: 700; background: #f8fafc; }
  .footer-note { margin-top: 24px; padding: 14px 18px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #1e5fae; }
  .footer-note p { font-size: 11.5px; color: #64748b; line-height: 1.6; }
  .email-footer { padding: 18px 32px; background: #102a43; text-align: center; }
  .email-footer p { color: rgba(255,255,255,0.6); font-size: 11px; }
  .email-footer strong { color: rgba(255,255,255,0.9); }
  .stat-pills { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  .stat-pill { background: #f1f5f9; border-radius: 8px; padding: 10px 16px; flex: 1; min-width: 120px; }
  .stat-pill .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-pill .val { font-size: 16px; font-weight: 700; color: #102a43; margin-top: 2px; }
  .stat-pill.green .val { color: #15803d; }
  .stat-pill.red .val { color: #dc2626; }
</style>
</head>
<body>
<div class="wrapper">

  <div class="header">
    <h1>ORN-ZKM Microfinance Institution</h1>
    <p>Salary Slip — Confidential</p>
  </div>

  <div class="slip-meta">
    <span><strong>Payroll No:</strong> {{ $slipData['payroll_no'] }}</span>
    <span><strong>Period:</strong> {{ $slipData['period'] }}</span>
    <span><strong>Pay Date:</strong> {{ $slipData['pay_date'] }}</span>
    <span><strong>Status:</strong> {{ strtoupper($slipData['status']) }}</span>
  </div>

  <div class="body">

    {{-- Employee Details --}}
    <div class="section-title">Employee Information</div>
    <div class="emp-grid">
      <div class="emp-field"><label>Employee ID</label><span>{{ $slipData['emp_id'] }}</span></div>
      <div class="emp-field"><label>Full Name</label><span>{{ $slipData['emp_name'] }}</span></div>
      <div class="emp-field"><label>Designation</label><span>{{ $slipData['designation'] ?? '—' }}</span></div>
      <div class="emp-field"><label>Department</label><span>{{ $slipData['department'] ?? '—' }}</span></div>
      <div class="emp-field"><label>Branch</label><span>{{ $slipData['branch'] ?? '—' }}</span></div>
      <div class="emp-field"><label>Employment Type</label><span>{{ ucfirst($slipData['employment_type'] ?? '—') }}</span></div>
      @if(!empty($slipData['tin_number']))
      <div class="emp-field"><label>TIN</label><span>{{ $slipData['tin_number'] }}</span></div>
      @endif
      @if(!empty($slipData['nssf_number']))
      <div class="emp-field"><label>NSSF No.</label><span>{{ $slipData['nssf_number'] }}</span></div>
      @endif
      @if(!empty($slipData['nhif_number']))
      <div class="emp-field"><label>NHIF No.</label><span>{{ $slipData['nhif_number'] }}</span></div>
      @endif
    </div>

    {{-- Summary Pills --}}
    <div class="section-title" style="margin-top:22px">Pay Summary</div>
    <div class="stat-pills">
      <div class="stat-pill">
        <div class="label">Gross Salary</div>
        <div class="val">TZS {{ number_format($slipData['gross_salary'], 0) }}</div>
      </div>
      <div class="stat-pill red">
        <div class="label">Total Deductions</div>
        <div class="val">TZS {{ number_format($slipData['total_deductions'], 0) }}</div>
      </div>
      <div class="stat-pill green">
        <div class="label">Net Salary</div>
        <div class="val">TZS {{ number_format($slipData['net_salary'], 0) }}</div>
      </div>
    </div>

    {{-- Earnings --}}
    @if(!empty($slipData['earnings']))
    <div class="section-title">Earnings</div>
    <table>
      <thead>
        <tr><th>Component</th><th class="right">Amount (TZS)</th></tr>
      </thead>
      <tbody>
        @foreach($slipData['earnings'] as $e)
        <tr>
          <td>{{ $e['name'] }} <span class="badge badge-earning">{{ $e['code'] }}</span></td>
          <td class="right">{{ number_format($e['amount'], 0) }}</td>
        </tr>
        @endforeach
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td>GROSS EARNINGS</td>
          <td class="right">{{ number_format($slipData['gross_salary'], 0) }}</td>
        </tr>
      </tfoot>
    </table>
    @endif

    {{-- Deductions --}}
    @if(!empty($slipData['deductions']))
    <div class="section-title">Deductions</div>
    <table>
      <thead>
        <tr><th>Component</th><th class="right">Amount (TZS)</th></tr>
      </thead>
      <tbody>
        @foreach($slipData['deductions'] as $d)
        <tr>
          <td>{{ $d['name'] }} <span class="badge badge-deduction">{{ $d['code'] }}</span></td>
          <td class="right">{{ number_format($d['amount'], 0) }}</td>
        </tr>
        @endforeach
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td>TOTAL DEDUCTIONS</td>
          <td class="right">{{ number_format($slipData['total_deductions'], 0) }}</td>
        </tr>
      </tfoot>
    </table>
    @endif

    {{-- Net Salary Box --}}
    <div class="net-box">
      <div class="label">NET SALARY PAYABLE</div>
      <div class="amount">TZS {{ number_format($slipData['net_salary'], 0) }}</div>
      <div class="words">{{ $slipData['net_words'] }}</div>
    </div>

    {{-- Payment Info --}}
    @if(!empty($slipData['payment_method']))
    <div class="section-title">Payment Details</div>
    <div class="pay-info">
      <div class="pay-field"><label>Payment Method</label><span>{{ ucwords(str_replace('_', ' ', $slipData['payment_method'])) }}</span></div>
      @if(!empty($slipData['bank_name']))
      <div class="pay-field"><label>Bank</label><span>{{ $slipData['bank_name'] }}</span></div>
      @endif
      @if(!empty($slipData['bank_account']))
      <div class="pay-field"><label>Account Number</label><span>{{ $slipData['bank_account'] }}</span></div>
      @endif
      @if(!empty($slipData['payment_reference']))
      <div class="pay-field"><label>Reference</label><span>{{ $slipData['payment_reference'] }}</span></div>
      @endif
      @if(!empty($slipData['payment_date']))
      <div class="pay-field"><label>Payment Date</label><span>{{ $slipData['payment_date'] }}</span></div>
      @endif
    </div>
    @endif

    <div class="footer-note">
      <p>This is a system-generated salary slip. If you have questions about your pay, contact the HR or Finance department.
      Do not reply to this email. Generated: {{ now()->format('d M Y H:i') }} UTC+3.</p>
    </div>

  </div>{{-- /body --}}

  <div class="email-footer">
    <p><strong>ORN-ZKM Microfinance Institution</strong> &nbsp;·&nbsp; Payroll Reference: {{ $slipData['payroll_no'] }}</p>
    <p style="margin-top:4px">This email and its contents are confidential and intended solely for the addressee.</p>
  </div>

</div>
</body>
</html>
