import fs from 'fs/promises';
import path from 'path';
import type { OutboundNotification } from './markdown-loader';

/**
 * TypeScript port of GEA_ST_vendor_portal/scripts/dispatch_notifications.py,
 * for running the dispatcher inside this app's own process on Railway (one
 * web service owns the volume — a Railway volume attaches to exactly one
 * service, so a separate cron service can't share it). Reads the same
 * `_outbound/*.json` queue and archive-folder convention; behaviour should
 * stay identical to the Python script, which remains the standalone-cron
 * option for local/dev or a non-Railway host.
 */

type QueueItem = OutboundNotification & {
  _attempts?: number;
  _last_error?: string;
  _last_attempt?: string;
  _sent_at?: string;
};

function maxAttempts(): number {
  return Number(process.env.MAX_ATTEMPTS || '3');
}

function propertiesDir(): string {
  return (
    process.env.PROPERTIES_DIR ||
    '/Users/stuartgrant_mbp13/Library/Mobile Documents/com~apple~CloudDocs/GEA_ST_vendor_portal/properties'
  );
}

function outboundDir(): string {
  return process.env.OUTBOUND_DIR || path.join(propertiesDir(), '_outbound');
}

async function sendEmail(item: QueueItem): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');
  const toAddr = item.to?.email;
  if (!toAddr) throw new Error('no recipient email on item');

  const sender = process.env.RESEND_FROM || 'Grant Estate Agency <portal@grantsea.com.au>';
  const first = (item.vendor || 'there').split(' ')[0];
  const body = item.body || '';
  const portalUrl = item.portalUrl || '';
  const cta = portalUrl
    ? `<p style="margin:24px 0;"><a href="${portalUrl}" style="background:#1A1814;color:#C8A96E;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">View Your Dashboard →</a></p>`
    : '';
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1A1814;"><p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#C8A96E;">Grant Estate Agency</p><h1 style="font-size:20px;font-weight:500;">Hi ${first},</h1><p style="font-size:15px;line-height:1.6;">${body}</p>${cta}<p style="font-size:12px;color:#8B8580;">Private &amp; confidential · This link is unique to you.</p></div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender, to: toAddr, subject: item.subject || 'Update on your campaign', html, text: body }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
}

async function sendSms(item: QueueItem): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const sender = process.env.TWILIO_FROM;
  if (!(sid && token && sender)) throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM not all set');
  const toPhone = item.to?.phone;
  if (!toPhone) throw new Error('no recipient phone on item');

  const portalUrl = item.portalUrl || '';
  const text = portalUrl ? `${item.body || ''}\n${portalUrl}`.trim() : item.body || '';
  const form = new URLSearchParams({ To: toPhone, From: sender, Body: text });
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Twilio HTTP ${res.status}: ${await res.text()}`);
}

export interface DispatchResult {
  total: number;
  sent: number;
  failed: string[];
}

async function processItem(dir: string, sentDir: string, failedDir: string, filename: string): Promise<boolean> {
  const filePath = path.join(dir, filename);
  let item: QueueItem;
  try {
    item = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    await fs.rename(filePath, path.join(failedDir, filename));
    return false;
  }

  const channel = item.channel || 'email';
  try {
    if (channel === 'email' || channel === 'both') await sendEmail(item);
    if (channel === 'sms' || channel === 'both') await sendSms(item);
  } catch (error) {
    const attempts = (item._attempts || 0) + 1;
    item._attempts = attempts;
    item._last_error = String(error);
    item._last_attempt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(item, null, 2) + '\n', 'utf-8');
    if (attempts >= maxAttempts()) {
      await fs.rename(filePath, path.join(failedDir, filename));
    }
    return false;
  }

  item._sent_at = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(item, null, 2) + '\n', 'utf-8');
  await fs.rename(filePath, path.join(sentDir, filename));
  return true;
}

export async function dispatchNotifications(): Promise<DispatchResult> {
  const dir = outboundDir();
  const sentDir = path.join(dir, 'sent');
  const failedDir = path.join(dir, 'failed');
  await fs.mkdir(sentDir, { recursive: true });
  await fs.mkdir(failedDir, { recursive: true });

  let entries: string[];
  try {
    entries = (await fs.readdir(dir)).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  } catch {
    return { total: 0, sent: 0, failed: [] };
  }
  entries.sort();

  const failed: string[] = [];
  let sent = 0;
  for (const filename of entries) {
    const ok = await processItem(dir, sentDir, failedDir, filename);
    if (ok) sent++;
    else failed.push(filename);
  }

  return { total: entries.length, sent, failed };
}
