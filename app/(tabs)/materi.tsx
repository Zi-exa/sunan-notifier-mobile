import { useEffect, useMemo, useRef, useState } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, useTheme } from '@/components/Redesign';
import { Badge } from '@/components/Redesign/Badge';
import { CardIconBubble, CardInfoTile } from '@/components/Redesign/CardInfoTile';
import { Radius, Shadow } from '@/components/Redesign/theme';
import { FloatingFilterMenu, type FloatingFilterOption } from '@/components/app/FloatingFilterMenu';
import { FloatingSearchBar } from '@/components/app/FloatingSearchBar';
import { TabScreenHeader } from '@/components/app/TabScreenHeader';
import { getFloatingFilterContentPadding } from '@/components/app/floatingLayout';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import { openSunanLink } from '@/lib/moodle/openSunanLink';
import { useMateriListQuery, isMateriDisplayRecent, getMateriDisplayIso, type MateriItem } from '@/lib/queries/useMateriQuery';
import { cleanUploaderName } from '@/lib/supabase/repositories';
import { useAuthStore } from '@/lib/stores/authStore';
import { downloadAndOpenMateriFileAsync, cancelMateriDownload } from '@/lib/materi/files';

const MODNAME_ICON: Record<string, React.ComponentProps<typeof FontAwesome>['name']> = {
  resource: 'file-text-o',
  url: 'link',
  page: 'file-o',
  book: 'book',
  folder: 'folder-o',
};

const MODNAME_LABEL: Record<string, string> = {
  resource: 'File',
  url: 'Tautan',
  page: 'Halaman',
  book: 'Buku',
  folder: 'Folder',
};

function modnameLabel(modname: string): string {
  return MODNAME_LABEL[modname] ?? 'Materi';
}

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

export function formatUploadDate(iso: string, long = false): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
  });
}

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
  const { height: windowHeight } = useWindowDimensions();
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
  const cancelledTagsRef = useRef<Set<string>>(new Set());
  const contentBottomPadding = getFloatingFilterContentPadding(insets.bottom);

  const highlightModuleId = Number(params.moduleId);
  const modalMaxHeight = Math.max(420, windowHeight - insets.top - insets.bottom - 48);

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

  const firstUploader = selected
    ? cleanUploaderName(selected.files.find((file) => !!file.uploader)?.uploader ?? null)
    : null;

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
    const tag = `${selected?.moduleId ?? 'materi'}-${fileIndex}`;
    cancelledTagsRef.current.delete(tag);
    setFileStates((prev) => ({ ...prev, [fileIndex]: { status: 'busy', percent: 0 } }));
    try {
      await downloadAndOpenMateriFileAsync({
        fileUrl: file.url,
        fileName: file.name,
        mimetype: file.mimetype,
        token,
        siteUrl,
        tag,
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
      if (cancelledTagsRef.current.has(tag)) {
        cancelledTagsRef.current.delete(tag);
        setFileStates((prev) => {
          const next = { ...prev };
          delete next[fileIndex];
          return next;
        });
        return;
      }
      setFileStates((prev) => ({
        ...prev,
        [fileIndex]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unduhan gagal.',
        },
      }));
    }
  };

  const handleCancelDownload = async (fileIndex: number) => {
    const tag = `${selected?.moduleId ?? 'materi'}-${fileIndex}`;
    cancelledTagsRef.current.add(tag);
    await cancelMateriDownload(tag);
    setFileStates((prev) => {
      const next = { ...prev };
      delete next[fileIndex];
      return next;
    });
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
                android_ripple={{ color: colors.borderMuted, borderless: false }}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: highlighted ? colors.accent : colors.borderSubtle,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.itemBody}>
                  <View style={styles.topRow}>
                    <View style={styles.courseWrap}>
                      <CardIconBubble icon="graduation-cap" tone="accent" size="xs" />
                      <Text style={[styles.course, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.courseName}
                      </Text>
                    </View>
                    <View style={styles.detailLinkRow}>
                      <Text style={[styles.detailLinkText, { color: colors.accentBright }]}>
                        Detail
                      </Text>
                      <FontAwesome name="angle-right" size={16} color={colors.accentBright} />
                    </View>
                  </View>
                  <View style={styles.heroRow}>
                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.moduleName}
                    </Text>
                    <View style={styles.heroBadges}>
                      {recent ? <Badge variant="accent" label="BARU" showDot /> : null}
                      <Badge variant="available" label={modnameLabel(item.modname)} />
                    </View>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
                  <View style={[styles.tileGrid, styles.tileGridThreeColumn]}>
                    <CardInfoTile
                      icon="book"
                      title="Materi"
                      trailingChevron
                      tone="accent"
                      compact
                      style={styles.tileColumnNarrow}
                      onPress={() => handleSelectMateri(item)}
                    />
                    <CardInfoTile
                      icon="calendar-o"
                      title="Diunggah"
                      value={formatUploadDate(getMateriDisplayIso(item))}
                      tone="accent"
                      compact
                      style={styles.tileColumnWide}
                    />
                    <CardInfoTile
                      icon={modnameIcon(item.modname)}
                      title="Berkas"
                      value={item.files.length > 0 ? `${item.files.length} file` : 'Lihat detail'}
                      tone="muted"
                      compact
                      style={styles.tileColumnWide}
                    />
                  </View>
                </View>
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
        <View style={styles.overlayRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSelected(null)} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
                marginTop: insets.top + 24,
                marginBottom: Math.max(insets.bottom + 24, 32),
                maxHeight: modalMaxHeight,
              },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderSubtle }]}>
              <View style={styles.headerCopy}>
                <Text style={[styles.modalEyebrow, { color: colors.textMuted }]}>RINGKASAN</Text>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Detail Materi</Text>
              </View>
              <Pressable
                onPress={() => setSelected(null)}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
                  pressed && { opacity: 0.82 },
                ]}
              >
                <FontAwesome name="close" size={16} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
                <View style={styles.headerBody}>
                  <Text style={[styles.course, { color: colors.textSecondary }]} numberOfLines={1}>
                    {selected?.courseName}
                  </Text>
                  <View style={styles.heroBadges}>
                    <Badge variant="available" label={modnameLabel(selected?.modname ?? '')} />
                    {selected && isMateriDisplayRecent(selected) ? (
                      <Badge variant="accent" label="BARU" showDot />
                    ) : null}
                  </View>
                  <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>
                    {selected?.moduleName}
                  </Text>
                  {!!selected && (
                    <MateriMetaRow
                      icon="calendar-o"
                      label="Diunggah"
                      value={formatUploadDate(getMateriDisplayIso(selected), true)}
                    />
                  )}
                  {!!selected?.sectionName && (
                    <MateriMetaRow icon="folder-o" label="Topik" value={selected.sectionName} />
                  )}
                  {!!firstUploader && (
                    <MateriMetaRow icon="user-o" label="Dosen" value={firstUploader} />
                  )}
                </View>
              </View>

              {!!selected?.description && (
                <View style={[styles.bodyCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
                  <View style={styles.sectionLabelRow}>
                    <FontAwesome name="align-left" size={12} color={colors.textMuted} />
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DESKRIPSI</Text>
                  </View>
                  <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
                    {selected.description}
                  </Text>
                </View>
              )}

              {selected && selected.files.length > 0 && (
                <View style={[styles.bodyCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
                  <View style={styles.sectionLabelRow}>
                    <FontAwesome name="file-o" size={12} color={colors.textMuted} />
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                      BERKAS ({selected.files.length})
                    </Text>
                  </View>
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
                            : (state?.status === 'error' ? state.message : formatFileSize(file.size))}
                        </Text>
                        {busy && (
                          <View style={[styles.dlBar, { backgroundColor: colors.borderSubtle }]}>
                            <View
                              style={[
                                styles.dlFill,
                                { backgroundColor: colors.accent, width: `${state.percent}%` },
                              ]}
                            />
                          </View>
                        )}
                      </View>
                      {busy ? (
                        <Pressable
                          onPress={() => void handleCancelDownload(index)}
                          hitSlop={10}
                          accessibilityLabel="Batalkan unduhan"
                        >
                          <FontAwesome name="close" size={15} color={colors.danger} />
                        </Pressable>
                      ) : (
                        <FontAwesome name="download" size={14} color={colors.textMuted} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              disabled={openingLink || !selected?.quickLink}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.accent },
                openingLink && { opacity: 0.68 },
                pressed && { opacity: 0.82 },
              ]}
              onPress={() => selected && void handleOpenMateri(selected)}
            >
              <View style={styles.primaryButtonContent}>
                <FontAwesome name="external-link" size={14} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {openingLink ? 'Membuka...' : 'Buka Materi di SUNAN'}
                </Text>
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </View>
      </Modal>
    </View>
  );
}

type MateriMetaRowProps = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
};

function MateriMetaRow({ icon, label, value }: MateriMetaRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.metaRow}>
      <View style={styles.metaLabelRow}>
        <FontAwesome name={icon} size={12} color={colors.textSecondary} />
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>{label}:</Text>
      </View>
      <Text style={[styles.metaText, { color: colors.textSecondary }]}>{value}</Text>
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
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.card,
  },
  pressed: {
    opacity: 0.9,
  },
  itemBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  courseWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLinkText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  course: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    opacity: 0.9,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tileGridThreeColumn: {
    gap: 4,
  },
  tileColumnNarrow: {
    flexBasis: '26.5%',
    maxWidth: '26.5%',
    flexGrow: 0,
  },
  tileColumnWide: {
    flexBasis: '34.5%',
    maxWidth: '34.5%',
    flexGrow: 0,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 8, 20, 0.68)' },
  overlayRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerCopy: {
    gap: 2,
    flexShrink: 1,
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 18,
  },
  headerCard: { borderRadius: Radius.lg, borderWidth: 1, ...Shadow.card },
  headerBody: { padding: 16, gap: 6 },
  detailTitle: { fontSize: 22, fontWeight: '800', lineHeight: 30 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13 },
  bodyCard: { borderRadius: Radius.md, borderWidth: 1, padding: 14, gap: 8, ...Shadow.subtle },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  description: { fontSize: 14, lineHeight: 22 },
  fileList: { gap: 8 },
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
  dlBar: { height: 5, borderRadius: 99, overflow: 'hidden', marginTop: 4 },
  dlFill: { height: '100%', borderRadius: 99 },
  primaryButton: { borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', ...Shadow.subtle },
  primaryButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
});
