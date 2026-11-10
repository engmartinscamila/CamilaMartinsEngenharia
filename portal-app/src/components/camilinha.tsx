/* Camilinha: animações originais do ChatGPT Work, atlas 8 colunas x 11 linhas.
   Não cobre controles nem executa operações: apenas comunica um estado real. */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Image, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';

export type CamilinhaState = 'idle' | 'running-right' | 'running-left' | 'waving' | 'jumping' | 'failed' | 'waiting' | 'running' | 'review';

const MOTIONS: Record<CamilinhaState, { row: number; frames: number; ms: number; loop: boolean }> = {
  idle: { row: 0, frames: 6, ms: 250, loop: true },
  'running-right': { row: 1, frames: 8, ms: 144, loop: true },
  'running-left': { row: 2, frames: 8, ms: 144, loop: true },
  waving: { row: 3, frames: 4, ms: 185, loop: false },
  jumping: { row: 4, frames: 5, ms: 180, loop: false },
  failed: { row: 5, frames: 8, ms: 138, loop: false },
  waiting: { row: 6, frames: 6, ms: 233, loop: true },
  running: { row: 7, frames: 6, ms: 200, loop: true },
  review: { row: 8, frames: 6, ms: 200, loop: true },
};

const ORIGINAL_WORK_ATLAS = require('../../assets/camilinha/work-atlas.png');
const CELL_RATIO = 104 / 96;

export function CamilinhaSprite({ state = 'waiting', size = 40 }: { state?: CamilinhaState; size?: number }) {
  const motion = MOTIONS[state];
  const [frame, setFrame] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then((enabled) => { if (mounted) setReducedMotion(Boolean(enabled)); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      if (step >= motion.frames) {
        if (motion.loop) step = 0;
        else { clearInterval(timer); step = motion.frames - 1; }
      }
      setFrame(step);
    }, motion.ms);
    return () => clearInterval(timer);
  }, [motion, reducedMotion]);

  const frameHeight = size * CELL_RATIO;
  return (
    <View accessible={false} style={{ width: size, height: frameHeight, overflow: 'hidden' }}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="stretch"
        source={ORIGINAL_WORK_ATLAS}
        style={{
          position: 'absolute',
          width: size * 8,
          height: frameHeight * 11,
          left: -frame * size,
          top: -motion.row * frameHeight,
        }}
      />
    </View>
  );
}

/** Aparece apenas quando a operação dura mais que o intervalo definido. */
type ActivityProps = {
  active: boolean;
  state?: CamilinhaState;
  label?: string;
  size?: number;
  delayMs?: number;
  compact?: boolean;
};

/** Ao desativar, desmonta o componente e reinicia a espera na próxima operação. */
export function CamilinhaActivity(props: ActivityProps) {
  return props.active ? <ActiveCamilinhaActivity {...props} /> : null;
}

function ActiveCamilinhaActivity({
  state = 'running',
  label,
  size = 40,
  delayMs = 500,
  compact = false,
}: ActivityProps) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), Math.max(0, delayMs));
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: compact ? 0 : 10, flexShrink: 1 }}
    >
      {visible ? (
        <CamilinhaSprite key={state} state={state} size={size} />
      ) : (
        <ActivityIndicator accessibilityLabel={label ?? 'Carregando'} color={colors.gold600} size="small" />
      )}
      {!compact && label ? (
        <Text style={{ color: colors.muted, flexShrink: 1, fontSize: 12 }}>{label}</Text>
      ) : null}
    </View>
  );
}
