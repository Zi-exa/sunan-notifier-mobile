export type MoodleTokenResponse = {
  token?: string;
  privatetoken?: string;
  error?: string;
  errorcode?: string;
  stacktrace?: string;
  debuginfo?: string;
};

export type MoodleSiteInfo = {
  userid: number;
  username: string;
  fullname: string;
  firstname?: string;
  lastname?: string;
  siteurl: string;
  userpictureurl?: string;
};

export type MoodleCourse = {
  id: number;
  shortname: string;
  fullname: string;
};

export type MoodleAssignment = {
  id: number;
  cmid: number;
  course: number;
  name: string;
  intro?: string;
  introformat?: number;
  duedate: number;
  cutoffdate: number;
  allowsubmissionsfromdate: number;
  nosubmissions?: number;
  timemodified?: number;
};

export type MoodleAssignmentsPayload = {
  courses: Array<{
    id: number;
    fullname: string;
    shortname: string;
    assignments: MoodleAssignment[];
  }>;
};

export type MoodleQuiz = {
  id: number;
  course: number;
  coursemodule?: number;
  cmid?: number;
  name: string;
  intro?: string;
  introformat?: number;
  timeopen: number;
  timeclose: number;
  timelimit?: number;
};

export type MoodleQuizzesPayload = {
  quizzes: MoodleQuiz[];
};

export type MoodleQuizAttempt = {
  id: number;
  state?: string;
  timemodified?: number;
  timefinish?: number;
};

export type MoodleQuizAttemptsPayload = {
  attempts: MoodleQuizAttempt[];
};

export type MoodleCalendarEvent = {
  id: number;
  name: string;
  description?: string;
  timestart: number;
  timeduration: number;
  eventtype?: string;
  courseid?: number;
  course?: {
    id: number;
    fullname?: string;
    shortname?: string;
  };
  url?: string;
  instance?: number;
  modulename?: string;
};

export type MoodleCalendarPayload = {
  events: MoodleCalendarEvent[];
};

export type MoodleSubmissionStatus = {
  lastattempt?: {
    submission?: {
      id: number;
      status: string;
      timemodified: number;
      plugins?: unknown[];
    };
  };
};

export type AssignmentStatus = 'pending' | 'submitted' | 'overdue' | 'unknown';

export type TaskActivityType = 'assignment' | 'quiz';

export type AttendanceStatus = 'upcoming' | 'open' | 'closing_soon' | 'closed' | 'available';
export type AttendanceMarkVariant = 'submitted' | 'pending' | 'overdue' | 'accent';

export type AssignmentItem = {
  id: number;
  sourceId: number;
  activityType: TaskActivityType;
  cmid: number;
  courseId: number;
  courseName: string;
  name: string;
  openDate?: number;
  dueDate: number;
  cutoffDate: number;
  intro?: string;
  status: AssignmentStatus;
  submissionModifiedAt?: number;
  statusResolved?: boolean;
  quickLink: string;
};

export type AttendanceItem = {
  eventId: number;
  courseId?: number;
  attendanceInstanceId?: number;
  courseName: string;
  title: string;
  description?: string;
  startsAt?: number;
  closesAt?: number;
  status: AttendanceStatus;
  isMarked?: boolean;
  attendanceMarkLabel?: string;
  attendanceMarkVariant?: AttendanceMarkVariant;
  quickLink?: string;
  source: 'calendar';
};

export type NotificationKind =
  | 'new_task'
  | 'deadline_h1'
  | 'deadline_today'
  | 'task_open'
  | 'task_closing'
  | 'attendance_open'
  | 'attendance_closing';
