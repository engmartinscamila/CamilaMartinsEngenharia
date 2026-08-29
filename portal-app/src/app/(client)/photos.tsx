import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ProjectPicker } from '@/components/project-picker';
import { Button, Notice, PageHeader, Screen, StateView } from '@/components/ui';
import { openExternalUrl } from '@/lib/external-link';
import { formatDate } from '@/lib/format';
import { useProject } from '@/providers/project-provider';
import { useAppTheme, useThemeStyles } from '@/providers/theme-provider';
import { createPhotoSignedUrl, listPhotos } from '@/services/portal-service';
import { radius, spacing, ThemeColors, typography } from '@/theme/tokens';
import type { PhotoSummary } from '@/types/domain';

export default function PhotosScreen() {
  const { selectedProject } = useProject();
  const [photos, setPhotos] = useState<PhotoSummary[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useAppTheme();
  const styles = useThemeStyles(styleDefinitions);

  const load = useCallback(async () => {
    if (!selectedProject) {
      setPhotos([]);
      setUrls({});
      return;
    }
    setLoading(true);
    setError(null);
    const result = await listPhotos(selectedProject.id);
    setPhotos(result.data);
    setError(result.error);
    const signed = await Promise.all(
      result.data.map(async (photo) => {
        if (!photo.storagePath) return [photo.id, null] as const;
        const response = await createPhotoSignedUrl(photo);
        return [photo.id, response.url] as const;
      }),
    );
    setUrls(Object.fromEntries(signed.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    setLoading(false);
  }, [selectedProject]);

  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);

  const openPhoto = async (photo: PhotoSummary) => {
    if (!photo.storagePath) return;
    setOpeningId(photo.id);
    const response = await createPhotoSignedUrl(photo);
    setOpeningId(null);
    if (!response.url) setError(response.error);
    else setError(await openExternalUrl(response.url));
  };

  return (
    <Screen>
      <PageHeader eyebrow="Registro visual protegido" title="Fotos e evolução" description="Imagens do projeto com acesso temporário e identificação quando forem autorais." />
      <ProjectPicker />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading ? <ActivityIndicator color={colors.gold600} /> : null}
      {!loading && selectedProject && photos.length === 0 ? (
        <StateView actionLabel="Atualizar" description="As fotos publicadas pela equipe aparecerão aqui." icon="images-outline" onAction={() => void load()} title="Nenhuma foto publicada" />
      ) : null}
      <View style={styles.gallery}>
        {photos.map((photo) => (
          <Pressable accessibilityRole="button" key={photo.id} onPress={() => void openPhoto(photo)} style={({ pressed }) => [styles.photoCard, pressed && styles.pressed]}>
            {urls[photo.id] ? (
              <Image accessibilityLabel={photo.title} contentFit="cover" source={urls[photo.id]} style={styles.image} transition={180} />
            ) : (
              <View style={[styles.image, styles.placeholder]}><Ionicons color={colors.gold600} name="image-outline" size={28} /></View>
            )}
            <View style={styles.copy}>
              <Text numberOfLines={2} style={styles.title}>{photo.title}</Text>
              <Text style={styles.meta}>{photo.category ?? 'Registro da obra'} • {formatDate(photo.createdAt)}</Text>
              <Text style={styles.protection}>{photo.protectionMode === 'authored_photo' ? 'Cópia autoral identificada' : 'Imagem administrativa autorizada'}</Text>
              {openingId === photo.id ? <ActivityIndicator color={colors.gold600} size="small" /> : null}
            </View>
          </Pressable>
        ))}
      </View>
      {photos.length > 0 ? <Button loading={loading} onPress={() => void load()} title="Atualizar galeria" variant="ghost" /> : null}
    </Screen>
  );
}

const styleDefinitions = (colors: ThemeColors) => ({
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCard: { width: '48%', minWidth: 150, flexGrow: 1, maxWidth: 340, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: 'hidden' },
  pressed: { opacity: 0.8 },
  image: { width: '100%', aspectRatio: 1.25, backgroundColor: colors.background },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  copy: { padding: spacing.sm, gap: 5 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700', fontFamily: typography.family },
  meta: { color: colors.muted, fontSize: 11, fontFamily: typography.family },
  protection: { color: colors.gold600, fontSize: 10, fontWeight: '700', fontFamily: typography.family },
});
