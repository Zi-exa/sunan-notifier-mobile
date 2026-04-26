import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AttendanceCard, EmptyState, SectionCard, TaskCard, useTheme, Radius } from '@/components/Redesign';
import { getDockContentPadding } from '@/components/app/floatingLayout';
import { getReadableErrorMessage } from '@/lib/moodle/errors';
import {
  useAssignmentsQuery,
  useAttendanceSessionsQuery,
  useCalendarEventsQuery,
  useCoursesQuery,
} from '@/lib/queries/useMoodleQueries';
import { isSameDate, toDateKey } from '@/lib/utils/date';

const STATUS_DOT_COLOR = {
  pending: '#FFB347',
  submitted: '#2ECC71',
  overdue: '#FF5C5C',
  unknown: '#4F8EF7',
} as const;

const ATTENDANCE_DOT_COLOR = '#A78BFA';

export default function CalendarScreen() {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const today = toDateKey(Math.floor(Date.now() / 1000));
  const [selectedDate, setSelectedDate] = useState(today);
  const coursesQuery = useCoursesQuery();
  const assignmentsQuery = useAssignmentsQuery();
  const calendarQuery = useCalendarEventsQuery();
  const attendanceQuery = useAttendanceSessionsQuery();

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      { marked?: boolean; dots?: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }
    > = {};

    const addDot = (dateKey: string, dotKey: string, color: string) => {
      if (!marks[dateKey]) marks[dateKey] = { dots: [] };
      const existing = marks[dateKey].dots ?? [];
      if (!existing.some((d) => d.key === dotKey)) {
        marks[dateKey] = { ...marks[dateKey], dots: [...existing, { key: dotKey, color }] };
      }
    };

    for (const assignment of assignmentsQuery.data ?? []) {
      addDot(toDateKey(assignment.dueDate), `task-${assignment.status}`, STATUS_DOT_COLOR[assignment.status]);
    }
    for (const session of attendanceQuery.data ?? []) {
      if (session.startsAt) addDot(toDateKey(session.startsAt), 'attendance', ATTENDANCE_DOT_COLOR);
    }

    for (const dateKey of Object.keys(marks)) {
      marks[dateKey] = {
        ...marks[dateKey],
        marked: true,
        selected: dateKey === selectedDate,
        selectedColor: colors.accent,
      };
    }

    if (!marks[selectedDate]) {
      marks[selectedDate] = { selected: true, selectedColor: colors.accent };
    } else {
      marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: colors.accent };
    }

    return marks;
  }, [assignmentsQuery.data, attendanceQuery.data, selectedDate, colors.accent]);

  const dueTasksOnDate = useMemo(
    () => (assignmentsQuery.data ?? []).filter((a) => isSameDate(a.dueDate, selectedDate)),
    [assignmentsQuery.data, selectedDate]
  );
  const attendanceOnDate = useMemo(
    () => (attendanceQuery.data ?? []).filter((s) => s.startsAt && isSameDate(s.startsAt, selectedDate)),
    [attendanceQuery.data, selectedDate]
  );
  const eventsOnDate = useMemo(
    () => (calendarQuery.data ?? []).filter((e) => isSameDate(e.timestart, selectedDate)),
    [calendarQuery.data, selectedDate]
  );

  const isLoading =
    coursesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    calendarQuery.isLoading ||
    attendanceQuery.isLoading;
  const isError =
    coursesQuery.isError ||
    assignmentsQuery.isError ||
    calendarQuery.isError ||
    attendanceQuery.isError;
  const contentBottomPadding = getDockContentPadding(insets.bottom);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.bgBase }]}
      contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
      scrollIndicatorInsets={{ bottom: contentBottomPadding }}
    >
      {/* Calendar card */}
      <View style={[styles.calendarCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
        <View style={[styles.calendarHeader, { borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.calendarHeaderRow}>
            <View style={[styles.calendarHeaderIcon, { backgroundColor: colors.accentDim }]}>
              <FontAwesome name="calendar" size={14} color={colors.accent} />
            </View>
            <View style={styles.calendarHeaderText}>
              <Text style={[styles.calendarHeaderTitle, { color: colors.textPrimary }]}>Kalender Akademik</Text>
              <Text style={[styles.calendarHeaderSubtitle, { color: colors.textSecondary }]}>{selectedDate}</Text>
            </View>
          </View>
        </View>
        <Calendar
          key={mode}
          markingType="multi-dot"
          markedDates={markedDates}
          onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
          theme={{
            calendarBackground: colors.bgCard,
            backgroundColor: colors.bgCard,
            dayTextColor: colors.textPrimary,
            textDisabledColor: colors.textMuted,
            selectedDayTextColor: '#FFFFFF',
            selectedDayBackgroundColor: colors.accent,
            todayTextColor: colors.accent,
            todayBackgroundColor: 'transparent',
            arrowColor: colors.accent,
            monthTextColor: colors.textPrimary,
            textDayHeaderFontWeight: '600',
            textSectionTitleColor: colors.textSecondary,
            dotColor: colors.accent,
            selectedDotColor: '#FFFFFF',
          }}
        />

        {/* Legend */}
        <View style={[styles.legendRow, { borderTopColor: colors.borderSubtle }]}>
          {[
            { key: 'pending', label: 'Pending', color: STATUS_DOT_COLOR.pending },
            { key: 'submit', label: 'Submit', color: STATUS_DOT_COLOR.submitted },
            { key: 'overdue', label: 'Overdue', color: STATUS_DOT_COLOR.overdue },
            { key: 'absensi', label: 'Absensi', color: ATTENDANCE_DOT_COLOR },
          ].map((item) => (
            <View key={item.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <SectionCard title="Deadline" icon="graduation-cap" subtitle={selectedDate}>
        <View style={styles.sectionList}>
          {isLoading ? (
            <View style={[styles.stateCard, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Menyusun kalender deadline...</Text>
              <Text style={[styles.stateDescription, { color: colors.textSecondary }]}>
                Menyiapkan tugas, absensi, dan event kalender.
              </Text>
            </View>
          ) : isError ? (
            <EmptyState
              title="Kalender belum tersedia"
              description={getReadableErrorMessage(
                coursesQuery.error ?? assignmentsQuery.error ?? calendarQuery.error ?? attendanceQuery.error,
                'calendar'
              )}
              icon="warning"
            />
          ) : dueTasksOnDate.length === 0 ? (
            <EmptyState title="Tidak ada deadline" description="Belum ada tugas dengan deadline pada tanggal ini." icon="check-circle-o" />
          ) : (
            dueTasksOnDate.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={(selectedTask) => router.push(`/task/${selectedTask.id}`)}
              />
            ))
          )}
        </View>
      </SectionCard>

      <SectionCard title="Absensi" icon="check-square-o" subtitle={selectedDate}>
        <View style={styles.sectionList}>
          {isLoading || isError ? null : attendanceOnDate.length === 0 ? (
            <EmptyState title="Tidak ada absensi" description="Tidak ada sesi absensi pada tanggal ini." icon="check-square-o" />
          ) : (
            attendanceOnDate.map((session) => (
              <AttendanceCard key={session.eventId} attendance={session} />
            ))
          )}
        </View>
      </SectionCard>

      {/* Calendar events */}
      {eventsOnDate.length > 0 && (
        <SectionCard title="Event Kalender SUNAN" icon="calendar-o">
          <View style={styles.sectionList}>
            {eventsOnDate.map((event) => (
              <View key={event.id} style={[styles.eventItem, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
                <View style={styles.eventTitleRow}>
                  <FontAwesome name="calendar-check-o" size={13} color={colors.accent} />
                  <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.name}</Text>
                </View>
                {!!event.description && (
                  <Text style={[styles.eventDescription, { color: colors.textSecondary }]}>{event.description}</Text>
                )}
              </View>
            ))}
          </View>
        </SectionCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
  calendarCard: { borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1 },
  calendarHeader: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  calendarHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calendarHeaderIcon: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  calendarHeaderText: { gap: 2 },
  calendarHeaderTitle: { fontSize: 15, fontWeight: '700' },
  calendarHeaderSubtitle: { fontSize: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 10, paddingHorizontal: 4, borderTopWidth: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
  sectionList: { gap: 10 },
  stateCard: { minHeight: 220, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  stateTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stateDescription: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  eventItem: { borderRadius: Radius.md, borderWidth: 1, padding: 12, gap: 4 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTitle: { fontSize: 14, fontWeight: '700' },
  eventDescription: { fontSize: 13, lineHeight: 19 },
});
