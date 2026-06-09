import { startOfWeek, endOfWeek, format, addDays, isSameDay } from 'date-fns';

export interface WeekInfo {
    weekNumber: number;
    year: number;
    startDate: Date; // Monday
    endDate: Date; // Saturday
    label: string;
}

export function getWeekNumber(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - startOfYear.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
}

export function getWeekInfo(date: Date = new Date()): WeekInfo {
    // Get Monday of the week
    const monday = startOfWeek(date, { weekStartsOn: 1 });

    // Get Saturday of the week (5 days after Monday)
    const saturday = addDays(monday, 5);

    // Calculate week number
    const weekNumber = getWeekNumber(monday);
    const year = monday.getFullYear();

    return {
        weekNumber,
        year,
        startDate: monday,
        endDate: saturday,
        label: `Week ${weekNumber} (${format(monday, 'MMM dd')} - ${format(saturday, 'MMM dd, yyyy')})`,
    };
}

export function getWeekDays(startDate: Date): Date[] {
    // Returns Monday to Saturday
    return Array.from({ length: 6 }, (_, i) => addDays(startDate, i));
}

export function isCurrentWeek(weekStartDate: Date): boolean {
    const currentWeek = getWeekInfo();
    return isSameDay(weekStartDate, currentWeek.startDate);
}

export function isWeekCompleted(weekEndDate: Date): boolean {
    const now = new Date();
    return now > weekEndDate;
}
