import { describe, it, expect } from 'vitest';
import { renderVendorEmail } from '@/lib/notify-email';

describe('renderVendorEmail', () => {
  it('escapes a message containing a script tag', () => {
    const html = renderVendorEmail({
      ownerName: 'Vikram',
      address: '85 Centenary Blvd',
      portalUrl: 'https://portal.grantsea.com.au/vendor/abc',
      message: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders the default copy when no message is supplied', () => {
    const html = renderVendorEmail({
      address: '85 Centenary Blvd',
      portalUrl: 'https://portal.grantsea.com.au/vendor/abc',
    });
    expect(html).toContain('Your personalised campaign dashboard is ready');
  });
});
