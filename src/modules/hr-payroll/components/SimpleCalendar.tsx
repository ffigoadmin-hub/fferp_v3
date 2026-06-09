import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SimpleCalendarProps {
  selectedYear: number;
  selectedMonth: number;
  fromDate: Date | undefined;
  toDate: Date | undefined;
  onDateRangeChange: (fromDate: Date | undefined, toDate: Date | undefined) => void;
}

export const SimpleCalendar: React.FC<SimpleCalendarProps> = ({
  selectedYear,
  selectedMonth,
  fromDate,
  toDate,
  onDateRangeChange
}) => {
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(selectedYear, selectedMonth, day);
    
    if (!fromDate || (fromDate && toDate)) {
      // Start new selection
      onDateRangeChange(clickedDate, undefined);
    } else if (fromDate && !toDate) {
      // Complete the range
      if (clickedDate < fromDate) {
        onDateRangeChange(clickedDate, fromDate);
      } else {
        onDateRangeChange(fromDate, clickedDate);
      }
    }
  };

  const clearSelection = () => {
    onDateRangeChange(undefined, undefined);
  };

  const isDateInRange = (day: number) => {
    const currentDate = new Date(selectedYear, selectedMonth, day);
    if (!fromDate) return false;
    if (!toDate) return currentDate.getTime() === fromDate.getTime();
    return currentDate >= fromDate && currentDate <= toDate;
  };

  const isStartDate = (day: number) => {
    if (!fromDate) return false;
    const currentDate = new Date(selectedYear, selectedMonth, day);
    return currentDate.getTime() === fromDate.getTime();
  };

  const isEndDate = (day: number) => {
    if (!toDate) return false;
    const currentDate = new Date(selectedYear, selectedMonth, day);
    return currentDate.getTime() === toDate.getTime();
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstDayOfMonth = getFirstDayOfMonth(selectedYear, selectedMonth);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const renderCalendarDays = () => {
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Add day names
    dayNames.forEach(dayName => {
      days.push(
        <div key={dayName} className="text-center text-xs font-medium text-muted-foreground p-1">
          {dayName}
        </div>
      );
    });

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div key={`empty-${i}`} className="p-1"></div>
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const inRange = isDateInRange(day);
      const isStart = isStartDate(day);
      const isEnd = isEndDate(day);

      days.push(
        <Button
          key={day}
          variant={inRange ? "default" : "ghost"}
          className={`h-8 w-8 p-0 text-xs ${
            isStart ? 'bg-blue-600 hover:bg-blue-700 text-white' : 
            isEnd ? 'bg-blue-600 hover:bg-blue-700 text-white' : 
            inRange ? 'bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:hover:bg-blue-800 dark:text-blue-100' : 'hover:bg-muted'
          }`}
          onClick={() => handleDateClick(day)}
        >
          {day}
        </Button>
      );
    }

    return days;
  };

  return (
    <div className="border rounded-lg p-2 bg-card">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">
          {monthNames[selectedMonth]} {selectedYear}
        </h3>
        <div className="flex gap-1">
          {(fromDate || toDate) && (
            <Button variant="outline" size="sm" onClick={clearSelection} className="h-6 px-2 text-xs">
              Clear
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-0.5">
        {renderCalendarDays()}
      </div>
      
      {(fromDate || toDate) && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
          <div className="font-medium">Selected Range:</div>
          <div>
            From: {fromDate ? fromDate.toLocaleDateString() : 'Not selected'}
          </div>
          <div>
            To: {toDate ? toDate.toLocaleDateString() : 'Not selected'}
          </div>
          {fromDate && toDate && (
            <div className="text-green-600 dark:text-green-400 font-medium">
              Days: {Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 3600 * 24)) + 1}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
