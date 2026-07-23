/**
 * Navixa — path-segment invite deep link (`navixa://join/<code>`).
 *
 * The server's `deepLink` uses a path segment (`navixa://join/<code>`) while
 * its `universalLink` uses a query param (`/join?code=<code>`). This tiny
 * bridge normalises the path-segment form into the shared `/join?code=` entry
 * point so both links follow the exact same signed-in / signed-out flow.
 */
import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { parseInviteCode } from '@/features/onlineMatch';

export default function JoinCodeRedirect() {
  const params = useLocalSearchParams<{ code?: string }>();
  const code = params.code ? parseInviteCode(String(params.code)) : null;

  return <Redirect href={code ? `/join?code=${code}` : '/online/join/new'} />;
}
