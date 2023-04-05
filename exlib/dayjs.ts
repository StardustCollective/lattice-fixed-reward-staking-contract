import dayjs from 'dayjs';
import dayjs_utc from 'dayjs/plugin/utc';
import dayjs_duration from 'dayjs/plugin/duration';
import dayjs_realtivetime from 'dayjs/plugin/relativeTime';

const initializeDayJs = () => {
  dayjs.extend(dayjs_utc);
  dayjs.extend(dayjs_duration);
  dayjs.extend(dayjs_realtivetime);
};

export { initializeDayJs };
