import { NextRequest, NextResponse } from 'next/server';
import { generateSchedule } from '@/lib/scheduler';
import type { ScheduleParams } from '@/types/schedule';

export async function POST(request: NextRequest) {
  const params: ScheduleParams = await request.json();
  const result = await generateSchedule(params);
  return NextResponse.json(result);
}
