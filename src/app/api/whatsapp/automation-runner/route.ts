import { NextRequest, NextResponse } from 'next/server';
import { CsvAutomationRunner } from '@/services/csv-automation-runner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const runner = CsvAutomationRunner.getInstance();
    const data = await runner.getState();
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch automation state' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, queue, delaySettings, defaultCountryCode, simulateTyping, recipientId } = body;

    const runner = CsvAutomationRunner.getInstance();

    if (action === 'start') {
      if (!Array.isArray(queue) || queue.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Queue items array is required to start automation.' },
          { status: 400 }
        );
      }
      const state = await runner.start(
        queue,
        delaySettings,
        defaultCountryCode || '20',
        simulateTyping !== false
      );
      return NextResponse.json({ success: true, state });
    }

    if (action === 'pause') {
      const state = await runner.pause();
      return NextResponse.json({ success: true, state });
    }

    if (action === 'resume') {
      const state = await runner.resume();
      return NextResponse.json({ success: true, state });
    }

    if (action === 'stop') {
      const state = await runner.stop();
      return NextResponse.json({ success: true, state });
    }

    if (action === 'retry-failed') {
      const state = await runner.retryFailed(delaySettings);
      return NextResponse.json({ success: true, state });
    }

    if (action === 'retry-single' && recipientId) {
      const res = await runner.retrySingle(recipientId);
      return NextResponse.json({ success: res.success, state: res.state, error: res.error });
    }

    if (action === 'sync') {
      const data = await runner.getState();
      return NextResponse.json({ success: true, ...data });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Automation runner request error' },
      { status: 500 }
    );
  }
}
