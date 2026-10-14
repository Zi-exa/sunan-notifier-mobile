import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, useTheme } from '@/components/Redesign';
import { Radius } from '@/components/Redesign/theme';
import { FloatingFilterMenu, type FloatingFilterOption } from '@/components/app/FloatingFilterMenu';
import { FloatingSearchBar } from '@/components/app/FloatingSearchBar';
import { TabScreenHeader } from '@/components/app/TabScreenHeader';
import { getFloatingFilterContentPadding } from '@/components/app/floatingLayout';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { openSunanLink } from '@/lib/moodle/openSunanLink';
import { useMateriListQuery, isMateriDisplayRecent, getMateriDisplayIso, type MateriItem } from '@/lib/queries/useMateriQuery';
import { cleanUploaderName } from '@/lib/supabase/repositories';
import { useAuthStore } from '@/lib/stores/authStore';
import { downloadAndOpenMateriFileAsync } from '@/lib/materi/files';

const MODNAME_ICON: Record<string, React.ComponentProps<typeof FontAwesome>['name']> = {
  resource: 'file-text-o',
  url: 'link',
  page: 'file-o',
  book: 'book',
  folder: 'folder-o',
};

function modnameIcon(modname: string): React.ComponentProps<typeof FontAwesome>['name'] {
  return MODNAME_ICON[modname] ?? 'file-o';
}

export function formatFileSize(size: number | null): string {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

type FileDownloadState = { status: 'busy'; percent: number } | { status: 'error'; message: string };

export function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  const diffDays = Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
  return new Date(time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MateriScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ moduleId?: string; courseId?: string }>();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const privateToken = useAuthStore((state) => state.privateToken);
  const siteUrl = useAuthStore((state) => state.user?.siteUrl);
  const materiQuery = useMateriListQuery();
  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [selected, setSelected] = useState<MateriItem | null>(null);
  const [openingLink, setOpeningLink] = useState(false);
  const [fileStates, setFileStates] = useState<Record<number, FileDownloadState>>({});
  const contentBottomPadding = getFloatingFilterContentPadding(insets.bottom);

  const highlightModuleId = Number(params.moduleId);

  const filterOptions = useMemo<FloatingFilterOption<string>[]>(() => {
    const map = new Map<number, string>();
    (materiQuery.data ?? []).forEach((item) => {
      if (!map.has(item.courseId)) map.set(item.courseId, item.courseName);
    });
    return [
      { key: 'all', label: 'Semua', icon: 'th-large' },
      ...[...map.entries()].map(([id, name]) => ({
        key: String(id),
        label: name.length > 24 ? `${name.slice(0, 24)}…` : name,
        icon: 'book' as const,
      })),
    ];
  }, [materiQuery.data]);

  useEffect(() => {
    if (!filterOptions.some((option) => option.key === courseFilter)) {
      setCourseFilter('all');
    }
  }, [filterOptions, courseFilter]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (materiQuery.data ?? []).filter((item) => {
      if (courseFilter !== 'all' && String(item.courseId) !== courseFilter) return false;
      if (!q) return true;
      return (
        item.moduleName.toLowerCase().includes(q) ||
        item.courseName.toLowerCase().includes(q) ||
        item.files.some((f) => f.name.toLowerCase().includes(q))
      );
    });
  }, [materiQuery.data, query, courseFilter]);

  const handleOpenMateri = async (item: MateriItem) => {
    if (openingLink || !item.quickLink) return;
    setOpeningLink(true);
    try {
      await openSunanLink({ url: item.quickLink, token, userId, privateToken });
    } finally {
      setOpeningLink(false);
    }
  };

  const handleDownloadFile = async (fileIndex: number) => {
    const file = selected?.files[fileIndex];
    if (!file || fileStates[fileIndex]?.status === 'busy') return;
    setFileStates((prev) => ({ ...prev, [fileIndex]: { status: 'busy', percent: 0 } }));
    try {
      await downloadAndOpenMateriFileAsync({
        fileUrl: file.url,
        fileName: file.name,
        mimetype: file.mimetype,
        token,
        siteUrl,
        onProgress: (progress) => {
          setFileStates((prev) => ({
            ...prev,
            [fileIndex]: {
              status: 'busy',
              percent:
                progress.total > 0 ? Math.min(99, Math.round((progress.written / progress.total) * 100)) : 0,
            },
          }));
        },
      });
      setFileStates((prev) => {
        const next = { ...prev };
        delete next[fileIndex];
        return next;
      });
    } catch (error) {
      setFileStates((prev) => ({
        ...prev,
        [fileIndex]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unduhan gagal.',
        },
      }));
    }
  };

  const handleSelectMateri = (item: MateriItem) => {
    setFileStates({});
    setSelected(item);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <TabScreenHeader routeKey="materi" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
        scrollIndicatorInsets={{ bottom: contentBottomPadding }}
        refreshControl={
          <RefreshControl
            refreshing={materiQuery.isRefetching}
            onRefresh={() => materiQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        {materiQuery.isLoading ? (
          <View style={[styles.stateCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Memuat materi...</Text>
          </View>
        ) : materiQuery.isError ? (
          <EmptyState
            title="Materi belum bisa ditampilkan"
            description={getReadableErrorMessage(materiQuery.error, 'materi')}
            icon="warning"
          />
        ) : visibleItems.length === 0 ? (
          <EmptyState
            title={query || courseFilter !== 'all' ? 'Tidak ketemu' : 'Belum ada materi'}
            description={
              query || courseFilter !== 'all'
                ? 'Coba kata kunci atau matkul lain.'
                : 'Materi baru dari dosen akan muncul di sini.'
            }
            icon="inbox"
          />
        ) : (
          visibleItems.map((item) => {
            const highlighted =
              Number.isFinite(highlightModuleId) && item.moduleId === highlightModuleId;
            const recent = isMateriDisplayRecent(item);
            return (
              <Pressable
                key={`${item.courseId}-${item.moduleId}`}
                onPress={() => handleSelectMateri(item)}
                style={[
                  styles.item,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: highlighted ? colors.accent : colors.borderSubtle,
                  },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.accentDim }]}>
                  <FontAwesome name={modnameIcon(item.modname)} size={20} color={colors.accent} />
                </View>
                <View style={styles.itemBody}>
                  <Text style={[styles.course, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.courseName}
                  </Text>
                  <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.moduleName}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {formatRelativeTime(getMateriDisplayIso(item))}
                    {item.files.length > 0 ? ` • ${item.files.length} berkas` : ''}
                  </Text>
                </View>
                {recent && (
                  <View style={[styles.badge, { backgroundColor: colors.accentDim }]}>
                    <Text style={[styles.badgeText, { color: colors.accent }]}>BARU</Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <FloatingSearchBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Cari materi atau matkul..."
      />
      <FloatingFilterMenu
        title="Filter Matkul"
        options={filterOptions}
        selected={courseFilter}
        onSelect={setCourseFilter}
        allKey="all"
      />

      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)} />
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={[styles.modal, { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.modalCourse, { color: colors.textSecondary }]} numberOfLines={1}>
              {selected?.courseName}
            </Text>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{selected?.moduleName}</Text>
            {!!selected?.sectionName && (
              <View style={styles.modalMetaRow}>
                <FontAwesome name="folder-o" size={12} color={colors.textMuted} />
                <Text style={[styles.modalMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {selected.sectionName}
                </Text>
              </View>
            )}
            {!!selected?.description && (
              <Text style={[styles.modalDescription, { color: colors.textSecondary }]} numberOfLines={4}>
                {selected.description}
              </Text>
            )}
            {selected && selected.files.length > 0 && (
              <View style={styles.fileList}>
                {selected.files.slice(0, 5).map((file, index) => {
                  const state = fileStates[index];
                  const busy = state?.status === 'busy';
                  return (
                    <Pressable
                      key={index}
                      disabled={busy || !file.url}
                      onPress={() => void handleDownloadFile(index)}
                      style={({ pressed }) => [
                        styles.fileRow,
                        { backgroundColor: colors.bgCardHover, borderColor: colors.borderSubtle },
                        pressed && { opacity: 0.82 },
                      ]}
                    >
                      <FontAwesome name="file-o" size={14} color={colors.accent} />
                      <View style={styles.fileBody}>
                        <Text style={[styles.fileName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text style={[styles.fileMeta, { color: colors.textMuted }]}>
                          {busy
                            ? `Mengunduh... ${state.percent}%`
                            : state?.status === 'error'
                              ? state.message
                              : [formatFileSize(file.size), 'Ketuk untuk unduh & buka']
                                  .filter(Boolean)
                                  .join(' • ')}
                        </Text>
                        {!!cleanUploaderName(file.uploader) && (
                          <Text style={[styles.fileMeta, { color: colors.textMuted }]} numberOfLines={1}>
                            Oleh {cleanUploaderName(file.uploader)}
                          </Text>
                        )}
                      </View>
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <FontAwesome name="download" size={14} color={colors.textMuted} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setSelected(null)}
                style={[styles.modalButton, { borderColor: colors.borderSubtle }]}
              >
                <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Tutup</Text>
              </Pressable>
              <Pressable
                disabled={openingLink || !selected?.quickLink}
                onPress={() => selected && void handleOpenMateri(selected)}
                style={[
                  styles.modalButton,
                  styles.modalPrimary,
                  { backgroundColor: colors.accent },
                  (openingLink || !selected?.quickLink) && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  {openingLink ? 'Membuka...' : 'Buka di SUNAN'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 10 },
  stateCard: {
    minHeight: 260,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateTitle: { fontSize: 16, fontWeight: '700' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody: { flex: 1, gap: 2 },
  course: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  name: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  meta: { fontSize: 11, marginTop: 2 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 8, 20, 0.68)' },
  modalWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modal: { borderWidth: 1, borderRadius: Radius.lg, padding: 18, gap: 8 },
  modalCourse: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  modalTitle: { fontSize: 18, fontWeight: '800', lineHeight: 26 },
  modalMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalMeta: { fontSize: 12, fontWeight: '600', flex: 1 },
  modalDescription: { fontSize: 13, lineHeight: 20 },
  fileList: { gap: 8, marginTop: 4 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileBody: { flex: 1, gap: 2 },
  fileName: { fontSize: 13, fontWeight: '700' },
  fileMeta: { fontSize: 11 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimary: { borderWidth: 0 },
  modalButtonText: { fontSize: 14, fontWeight: '800' },
});
