/**
 * Notification Testing & Configuration Page
 *
 * Shows setup instructions for SendGrid (email) and Twilio (WhatsApp),
 * lets admins fire test notifications through all channels, and displays
 * a log of sent notifications for verification.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Mail, MessageCircle, Bell, Send, CheckCircle2, XCircle,
    ChevronLeft, Shield, AlertTriangle, Settings, Copy, Check,
} from 'lucide-react';
import { sendNotification } from '@/lib/notifications';

/* ─── types ─────────────────────────────────────────────────────────── */

interface NotifLog {
    id: string;
    title: string;
    channels: string[];
    status: 'success' | 'partial' | 'failed';
    channelResults: Record<string, { sent: boolean; error?: string }>;
    ts: number;
}

type Channel = 'email' | 'whatsapp' | 'sms';

/* ─── constants ─────────────────────────────────────────────────────── */

const ENV_VARS: { key: string; description: string; channel: Channel; example: string }[] = [
    { key: 'SENDGRID_API_KEY', description: 'SendGrid API key for transactional emails', channel: 'email', example: 'SG.xxxx…' },
    { key: 'SENDGRID_FROM_EMAIL', description: 'Verified sender email for SendGrid', channel: 'email', example: 'noreply@delegatecart.com' },
    { key: 'TWILIO_ACCOUNT_SID', description: 'Twilio Account SID', channel: 'whatsapp', example: 'ACxxxx…' },
    { key: 'TWILIO_AUTH_TOKEN', description: 'Twilio Auth Token', channel: 'whatsapp', example: '(secret)' },
    { key: 'TWILIO_WHATSAPP_FROM', description: 'Twilio WhatsApp sandbox/number', channel: 'whatsapp', example: 'whatsapp:+14155238886' },
    { key: 'CALLMEBOT_API_KEY', description: 'Free CallMeBot WhatsApp API key (fallback)', channel: 'whatsapp', example: '123456' },
];

const ADMIN_EMAILS = ['admin@delegatecart.com', 'admin@dc.com', 'admin@example.com'];

/* ─── component ─────────────────────────────────────────────────────── */

export default function NotificationTestingPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [selectedChannels, setSelectedChannels] = useState<Channel[]>(['email', 'whatsapp']);
    const [testTitle, setTestTitle] = useState('DelegateCart Test Notification');
    const [testMessage, setTestMessage] = useState('This is a test notification from the DelegateCart notification system. If you received this, your channel is configured correctly.');
    const [sending, setSending] = useState(false);
    const [logs, setLogs] = useState<NotifLog[]>([]);
    const [copied, setCopied] = useState<string | null>(null);

    /* ── admin check ─────────────────────────────────────────────────── */
    useEffect(() => {
        const email = localStorage.getItem('userEmail') || localStorage.getItem('dc-user-email') || '';
        setIsAdmin(ADMIN_EMAILS.includes(email) || email.includes('admin'));
        // load persisted logs
        try {
            const raw = localStorage.getItem('dc-notif-test-logs');
            if (raw) setLogs(JSON.parse(raw));
        } catch { /* ignore */ }
    }, []);

    const persistLogs = useCallback((next: NotifLog[]) => {
        setLogs(next);
        try { localStorage.setItem('dc-notif-test-logs', JSON.stringify(next.slice(0, 50))); } catch { /* ignore */ }
    }, []);

    /* ── send test ───────────────────────────────────────────────────── */
    const handleSendTest = async () => {
        if (!testTitle.trim() || !testMessage.trim() || selectedChannels.length === 0) return;
        setSending(true);
        try {
            const result = await sendNotification({
                title: testTitle.trim(),
                message: testMessage.trim(),
                type: 'general',
                channels: selectedChannels,
            });

            const allSent = Object.values(result.channelResults).every(r => r.sent);
            const noneSent = Object.values(result.channelResults).every(r => !r.sent);
            const entry: NotifLog = {
                id: `log-${Date.now()}`,
                title: testTitle.trim(),
                channels: selectedChannels,
                status: allSent ? 'success' : noneSent ? 'failed' : 'partial',
                channelResults: result.channelResults,
                ts: Date.now(),
            };
            persistLogs([entry, ...logs]);
        } catch (err: any) {
            const entry: NotifLog = {
                id: `log-${Date.now()}`,
                title: testTitle.trim(),
                channels: selectedChannels,
                status: 'failed',
                channelResults: Object.fromEntries(selectedChannels.map(ch => [ch, { sent: false, error: err.message }])) as any,
                ts: Date.now(),
            };
            persistLogs([entry, ...logs]);
        } finally {
            setSending(false);
        }
    };

    const toggleChannel = (ch: Channel) => {
        setSelectedChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(text);
            setTimeout(() => setCopied(null), 2000);
        });
    };

    /* ── render ──────────────────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/shopping-assistant"
                        className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                        data-testid="notif-back-btn"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Bell className="w-5 h-5 text-violet-500" />
                            Notification Testing &amp; Configuration
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Set up &amp; verify email, WhatsApp, and SMS notification channels
                        </p>
                    </div>
                </div>

                {/* ── Architecture Overview ─────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3" data-testid="notif-architecture">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Settings className="w-4 h-4 text-violet-500" /> Notification Architecture
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-3">
                        {[
                            { label: 'Email', icon: <Mail className="w-5 h-5 text-blue-500" />, provider: 'SendGrid / AWS SES', desc: 'Transactional emails for order updates, approvals, and share results.' },
                            { label: 'WhatsApp', icon: <MessageCircle className="w-5 h-5 text-green-500" />, provider: 'Twilio / CallMeBot', desc: 'WhatsApp messages for high-risk alerts and shared search results.' },
                            { label: 'In-App', icon: <Bell className="w-5 h-5 text-amber-500" />, provider: 'Built-in Toast System', desc: 'Real-time toasts via Zustand store. No external config required.' },
                        ].map(ch => (
                            <div key={ch.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    {ch.icon}
                                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{ch.label}</span>
                                </div>
                                <p className="text-[10px] text-gray-500 font-medium">{ch.provider}</p>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400">{ch.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Environment Variable Setup ────────────────────────────── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3" data-testid="notif-env-setup">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-500" /> Environment Variables Required
                    </h2>
                    <p className="text-xs text-gray-500">
                        Add these to your <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">.env</code> or
                        Docker <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">-e</code> flags.
                    </p>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {ENV_VARS.map(v => (
                            <div key={v.key} className="py-2 flex items-start gap-3">
                                <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${v.channel === 'email' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                    }`}>{v.channel}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs font-mono text-gray-900 dark:text-white">{v.key}</code>
                                        <button
                                            onClick={() => copyToClipboard(v.key)}
                                            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                                            title="Copy key name"
                                        >
                                            {copied === v.key ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{v.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5 font-mono">Example: {v.example}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Setup Guides ──────────────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4" data-testid="notif-setup-guides">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Setup Guides</h2>

                    {/* SendGrid */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 space-y-2">
                        <h3 className="text-xs font-bold text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5" /> SendGrid Email Setup
                        </h3>
                        <ol className="text-[11px] text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                            <li>Create a free account at <strong>sendgrid.com</strong> (100 emails/day free tier)</li>
                            <li>Go to <strong>Settings → API Keys → Create API Key</strong> (Full Access or Restricted: Mail Send)</li>
                            <li>Copy the key starting with <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">SG.</code></li>
                            <li>Add to your <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">.env</code>: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">SENDGRID_API_KEY=SG.xxxx</code></li>
                            <li>Verify a sender email under <strong>Sender Authentication</strong></li>
                            <li>Set <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">SENDGRID_FROM_EMAIL=verified@yourdomain.com</code></li>
                        </ol>
                    </div>

                    {/* Twilio WhatsApp */}
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-4 space-y-2">
                        <h3 className="text-xs font-bold text-green-800 dark:text-green-200 flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" /> Twilio WhatsApp Setup
                        </h3>
                        <ol className="text-[11px] text-green-700 dark:text-green-300 space-y-1 list-decimal list-inside">
                            <li>Create a Twilio account at <strong>twilio.com</strong> (free trial includes $15 credit)</li>
                            <li>Go to <strong>Messaging → Try it out → Send a WhatsApp message</strong></li>
                            <li>Join the sandbox by sending <code className="bg-green-100 dark:bg-green-800 px-1 rounded">join &lt;your-code&gt;</code> to the Twilio number</li>
                            <li>Copy <strong>Account SID</strong> and <strong>Auth Token</strong> from the <strong>Console Dashboard</strong></li>
                            <li>Set env vars: <code className="bg-green-100 dark:bg-green-800 px-1 rounded">TWILIO_ACCOUNT_SID</code>, <code className="bg-green-100 dark:bg-green-800 px-1 rounded">TWILIO_AUTH_TOKEN</code></li>
                            <li>Set <code className="bg-green-100 dark:bg-green-800 px-1 rounded">TWILIO_WHATSAPP_FROM=whatsapp:+14155238886</code> (sandbox number)</li>
                        </ol>
                    </div>

                    {/* CallMeBot Fallback */}
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
                        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> CallMeBot (Free Fallback)
                        </h3>
                        <ol className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
                            <li>Send <strong>&quot;I allow callmebot to send me messages&quot;</strong> to <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">+34 644 71 81 48</code> on WhatsApp</li>
                            <li>You&apos;ll receive an API key in the response message</li>
                            <li>Set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">CALLMEBOT_API_KEY=your-key</code> in env</li>
                            <li>Rate-limited to ~25 messages/day per number</li>
                        </ol>
                    </div>
                </section>

                {/* ── Test Notification Sender ──────────────────────────────── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4" data-testid="notif-test-sender">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Send className="w-4 h-4 text-violet-500" /> Send Test Notification
                    </h2>

                    {/* Channel selector */}
                    <div className="flex gap-2">
                        {([
                            { ch: 'email' as Channel, label: 'Email', icon: <Mail className="w-3.5 h-3.5" />, color: 'blue' },
                            { ch: 'whatsapp' as Channel, label: 'WhatsApp', icon: <MessageCircle className="w-3.5 h-3.5" />, color: 'green' },
                            { ch: 'sms' as Channel, label: 'SMS', icon: <Bell className="w-3.5 h-3.5" />, color: 'amber' },
                        ]).map(c => (
                            <button
                                key={c.ch}
                                onClick={() => toggleChannel(c.ch)}
                                data-testid={`notif-channel-${c.ch}`}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedChannels.includes(c.ch)
                                    ? c.color === 'blue' ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700'
                                        : c.color === 'green' ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700'
                                            : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700'
                                    : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                    }`}
                            >
                                {c.icon} {c.label}
                            </button>
                        ))}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
                        <input
                            type="text"
                            value={testTitle}
                            onChange={e => setTestTitle(e.target.value)}
                            data-testid="notif-test-title"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                            maxLength={100}
                        />
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">Message</label>
                        <textarea
                            value={testMessage}
                            onChange={e => setTestMessage(e.target.value)}
                            data-testid="notif-test-message"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none resize-y"
                            rows={3}
                            maxLength={500}
                        />
                    </div>

                    {/* Send */}
                    <button
                        onClick={handleSendTest}
                        disabled={sending || selectedChannels.length === 0 || !testTitle.trim() || !testMessage.trim()}
                        data-testid="notif-send-test-btn"
                        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        <Send className="w-4 h-4" />
                        {sending ? 'Sending…' : 'Send Test'}
                    </button>
                </section>

                {/* ── Notification Log ─────────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3" data-testid="notif-log">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Bell className="w-4 h-4 text-violet-500" /> Test Log ({logs.length})
                        </h2>
                        {logs.length > 0 && (
                            <button
                                onClick={() => persistLogs([])}
                                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                                data-testid="notif-clear-log"
                            >
                                Clear log
                            </button>
                        )}
                    </div>

                    {logs.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">No test notifications sent yet. Use the form above to send one.</p>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {logs.map(log => (
                                <div
                                    key={log.id}
                                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${log.status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                        : log.status === 'partial' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                                            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                        }`}
                                >
                                    {log.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                        : log.status === 'partial' ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                            : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-gray-900 dark:text-white truncate">{log.title}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {Object.entries(log.channelResults).map(([ch, r]) => (
                                                <span
                                                    key={ch}
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.sent ? 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300'
                                                        }`}
                                                >
                                                    {ch}: {r.sent ? '✓ sent' : `✗ ${r.error || 'failed'}`}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">{new Date(log.ts).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── API Reference ────────────────────────────────────────── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3" data-testid="notif-api-ref">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">API Reference</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 font-mono text-[11px] text-gray-700 dark:text-gray-300 space-y-2">
                        <p className="text-violet-600 dark:text-violet-400 font-bold">POST /api/notifications/send</p>
                        <pre className="whitespace-pre-wrap text-[10px] leading-relaxed">{`{
  "title": "string (required)",
  "message": "string (required)",
  "type": "order_success | order_failed | refund_initiated | general | ...",
  "channels": ["email", "whatsapp", "sms"],
  "metadata": { "orderId": "...", "amount": 1234 }
}`}</pre>
                        <p className="text-gray-500 text-[10px] mt-2">
                            Response: <code>{`{ success, channelResults: { email: { sent, error? }, ... } }`}</code>
                        </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 font-mono text-[11px] text-gray-700 dark:text-gray-300 space-y-2">
                        <p className="text-violet-600 dark:text-violet-400 font-bold">Frontend Helper — lib/notifications.ts</p>
                        <pre className="whitespace-pre-wrap text-[10px] leading-relaxed">{`import { sendNotification } from '@/lib/notifications';

await sendNotification({
  title: 'Order Placed',
  message: 'Your order #123 was placed.',
  type: 'order_success',
  channels: ['email', 'whatsapp'],
});`}</pre>
                    </div>
                </section>

                {/* ── Demo Mode Note ───────────────────────────────────────── */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                        <strong>Demo Mode:</strong> Without SendGrid/Twilio API keys, the notification API logs to the server console
                        and returns <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded text-[10px]">sent: true</code> for
                        testing purposes. All channel results will show success even without real delivery.
                        Check Docker container logs (<code className="bg-amber-100 dark:bg-amber-800 px-1 rounded text-[10px]">docker logs ai-commerce-web</code>)
                        to see notification payloads.
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-[10px] text-gray-400 pb-4">
                    DelegateCart Notification Testing · Round 33
                </p>
            </div>
        </div>
    );
}
