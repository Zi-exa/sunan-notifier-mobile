import {
  AssignmentItem,
  MoodleCalendarEvent,
  MoodleCourse,
  MoodleSiteInfo,
  MoodleSubmissionStatus,
} from '@/types/moodle';

const nowSeconds = Math.floor(Date.now() / 1000);

export const MOCK_SITE_INFO: MoodleSiteInfo = {
  userid: 202351207,
  username: '202351207',
  fullname: 'Mahasiswa SUNAN Demo',
  siteurl: 'https://sunan.umk.ac.id',
};

export const MOCK_COURSES: MoodleCourse[] = [
  {
    id: 101,
    shortname: 'ALPRO',
    fullname: 'Algoritma dan Pemrograman',
  },
  {
    id: 102,
    shortname: 'BASDAT',
    fullname: 'Basis Data',
  },
  {
    id: 103,
    shortname: 'JARKOM',
    fullname: 'Jaringan Komputer',
  },
];

export const MOCK_ASSIGNMENTS: AssignmentItem[] = [
  {
    id: 9001,
    sourceId: 9001,
    activityType: 'assignment',
    cmid: 4301,
    courseId: 101,
    courseName: 'Algoritma dan Pemrograman',
    name: 'Tugas Rekursi',
    dueDate: nowSeconds + 2 * 24 * 60 * 60,
    cutoffDate: nowSeconds + 3 * 24 * 60 * 60,
    intro: 'Implementasi factorial dan fibonacci menggunakan rekursi.',
    status: 'pending',
    statusResolved: true,
    quickLink: 'https://sunan.umk.ac.id/mod/assign/view.php?id=4301',
  },
  {
    id: 9002,
    sourceId: 9002,
    activityType: 'assignment',
    cmid: 4302,
    courseId: 102,
    courseName: 'Basis Data',
    name: 'Normalisasi 3NF',
    dueDate: nowSeconds + 7 * 24 * 60 * 60,
    cutoffDate: nowSeconds + 8 * 24 * 60 * 60,
    intro: 'Analisis skema tabel sampai bentuk normal ketiga.',
    status: 'submitted',
    submissionModifiedAt: nowSeconds - 2 * 24 * 60 * 60,
    statusResolved: true,
    quickLink: 'https://sunan.umk.ac.id/mod/assign/view.php?id=4302',
  },
  {
    id: 9003,
    sourceId: 9003,
    activityType: 'assignment',
    cmid: 4303,
    courseId: 103,
    courseName: 'Jaringan Komputer',
    name: 'Laporan Subnetting',
    dueDate: nowSeconds - 24 * 60 * 60,
    cutoffDate: nowSeconds,
    intro: 'Hitung subnet untuk 4 skenario jaringan kampus.',
    status: 'overdue',
    statusResolved: true,
    quickLink: 'https://sunan.umk.ac.id/mod/assign/view.php?id=4303',
  },
  {
    id: 2000005001,
    sourceId: 5001,
    activityType: 'quiz',
    cmid: 5301,
    courseId: 101,
    courseName: 'Algoritma dan Pemrograman',
    name: 'UTS Quiz Alpro',
    dueDate: nowSeconds + 90 * 60,
    cutoffDate: nowSeconds + 90 * 60,
    intro: 'UTS dibuka sesuai jadwal perkuliahan. Waktu pengerjaan 10 menit.',
    status: 'pending',
    statusResolved: true,
    quickLink: 'https://sunan.umk.ac.id/mod/quiz/view.php?id=5301',
  },
];

export const MOCK_CALENDAR_EVENTS: MoodleCalendarEvent[] = [
  {
    id: 501,
    name: 'Deadline Tugas Rekursi',
    timestart: nowSeconds + 2 * 24 * 60 * 60,
    timeduration: 0,
    courseid: 101,
    description: 'Batas akhir pengumpulan pukul 23.59',
  },
  {
    id: 502,
    name: 'Deadline Normalisasi 3NF',
    timestart: nowSeconds + 7 * 24 * 60 * 60,
    timeduration: 0,
    courseid: 102,
    description: 'Upload file PDF dan source SQL.',
  },
  {
    id: 503,
    name: 'Absensi Pertemuan 7 - Basis Data',
    timestart: nowSeconds - 10 * 60,
    timeduration: 30 * 60,
    courseid: 102,
    description: 'Absensi dibuka. Segera isi sebelum ditutup.',
    url: 'https://sunan.umk.ac.id/mod/attendance/view.php?id=5502',
    course: {
      id: 102,
      fullname: 'Basis Data',
      shortname: 'BASDAT',
    },
    modulename: 'attendance',
  },
  {
    id: 504,
    name: 'Presensi Praktikum JARKOM',
    timestart: nowSeconds + 45 * 60,
    timeduration: 20 * 60,
    courseid: 103,
    description: 'Presensi praktikum akan dibuka 45 menit lagi.',
    url: 'https://sunan.umk.ac.id/mod/attendance/view.php?id=5503',
    course: {
      id: 103,
      fullname: 'Jaringan Komputer',
      shortname: 'JARKOM',
    },
    modulename: 'attendance',
  },
];

export function mockSubmissionStatus(assignmentId: number): MoodleSubmissionStatus {
  const assignment = MOCK_ASSIGNMENTS.find((item) => item.id === assignmentId);

  if (!assignment || assignment.status === 'pending' || assignment.status === 'overdue') {
    return {
      lastattempt: {
        submission: {
          id: assignmentId,
          status: 'new',
          timemodified: nowSeconds,
        },
      },
    };
  }

  return {
    lastattempt: {
      submission: {
        id: assignmentId,
        status: 'submitted',
        timemodified: assignment.submissionModifiedAt ?? nowSeconds,
      },
    },
  };
}
