export function formatCurrency(amount: number, currency: 'LAK' | 'THB' | 'USD' = 'THB'): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0;
  }

  switch (currency) {
    case 'LAK':
      // Lao Kip typically doesn't use decimals in POS
      return `₭${Math.round(amount).toLocaleString('en-US')}`;
    case 'USD':
      return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'THB':
    default:
      return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatNumber(amount: number, decimals: number = 0): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0;
  }
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDateTime(isoString?: string | number | Date): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(isoString);
  }
}

export function formatDateOnly(isoString?: string | number | Date): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(isoString);
  }
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}${month}${day}-${rand}`;
}

export function generatePoNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PO-${year}${month}${day}-${rand}`;
}

export function generateSku(prefix: string = 'PRD'): string {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${rand}`;
}

export function generateBarcode(): string {
  // Generate valid 13-digit EAN-like code
  let code = '885'; // Thailand/regional prefix commonly used in POS test
  for (let i = 0; i < 9; i++) {
    code += Math.floor(Math.random() * 10);
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return code + checkDigit;
}
