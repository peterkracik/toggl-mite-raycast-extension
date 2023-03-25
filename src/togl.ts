import moment, { Moment } from 'moment';
import btoa from 'btoa';
import fetch from 'node-fetch';
import { randomInt } from 'crypto';

type TogglParams = {
  date: Moment;
  workspaceId: string;
  token: string;
}

export const getDate = (date: string) => {
  if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return moment(date);
  }
  if (date.match(/^\d{2}-\d{2}-\d{4}$/)) {
    return moment(date, 'DD-MM-YYYY');
  }
  if (date.match(/^\d{2}-\d{2}$/)) {
    return moment(date, 'DD-MM');
  }
  if (date.match(/^\d{2}$/)) {
    return moment(date, 'DD');
  }

  return moment();
}

export const getEntries = async ({ date, workspaceId, token }: TogglParams) => {
  const dateFrom = date.format('YYYY-MM-DD');
  const dateTo = date.format('YYYY-MM-DD');
  const userName = 'api_token';
  const authToken = btoa(`${token}:${userName}`);

  const requestOptions = {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${authToken}`
    },
    redirect: 'follow'
  };

  const output = await fetch(`https://api.track.toggl.com/reports/api/v2/details?since=${dateFrom}&until=${dateTo}&workspace_id=${workspaceId}&user_agent=api_test`, requestOptions)
  const response = await output.json();
  const togglEntries = response.data.map(item => {
    const newEntry = {
      duration: item.dur,
      description: item.description,
      client: item.client,
      project: item.project,
      tags: item.tags.join(','),
      start: +moment(item.start).format('X'),
      end: +moment(item.end).format('X'),
      id: item.id,
      date: moment(item.start).format('YYYY/MM/DD'),
      color: item.project_hex_color,
    };
    return newEntry;
  })

  return togglEntries;
};

export const getMiteEntries = async (entriesPromise) => {
  const togglEntries = await entriesPromise;
  const miteEntries: any[] = [];
  togglEntries.forEach(item => {
    const existing = miteEntries.find(entry => entry.description == item.description && entry.project == item.project)
    if (existing) {
      existing.duration += item.duration;
      const time = Math.round(existing.duration / 60000);
      existing.durationTime = `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, 0)}`;
    } else {
      const time = Math.round(item.duration / 60000);
      item.durationTime = `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, 0)}`;
      miteEntries.push(item);
    }

  })

  return miteEntries;
}


export const getTotal = async (entriesPromise) => {
  const step = 1 * 60;
  const togglEntries = await entriesPromise;
  const endWork = Math.max(...togglEntries.map(item => item.end), 0);
  const toTime = endWork + step + step;
  const startWork = Math.min(...togglEntries.map(item => item.start), toTime);
  let workTime = togglEntries.reduce((total, item) => (total + (item.durationTime ? item.duration : 0)), 0);
  const breakTime = Math.round((endWork - startWork - (workTime / 1000)) / 60);
  workTime = Math.round(workTime / 60000);

  const workTimeStr = `${Math.floor(workTime / 60)}:${(workTime % 60).toString().padStart(2, 0)}`;
  const breakTimeStr = `${Math.floor(breakTime / 60)}:${(breakTime % 60).toString().padStart(2, 0)}`;

  return { worktime: workTimeStr, breaktime: breakTimeStr };

}


export const getPersonioEnties = async (entriesPromise) => {
  const step = 1 * 60;
  const togglEntries = await entriesPromise;
  const endWork = Math.max(...togglEntries.map(item => item.end), 0);
  const toTime = endWork + step + step;
  const startWork = Math.min(...togglEntries.map(item => item.start), toTime);
  const fromTime = startWork - step - step;

  const personioEntries = {};
  for (let i = fromTime; i <= toTime; i = i + step) {
    personioEntries[i] = !!togglEntries.find(item => i > item.start && i < item.end)
  }

  const timeEntries = [];
  let searchStart = true;


  Object.entries(personioEntries).forEach(([key, value]) => {
    if (searchStart) {
      if (value === true) {
        timeEntries.push({ start: moment.unix(key).format('HH:mm') });
        searchStart = false;
      }
    }
    else {
      if (!value) {
        timeEntries[timeEntries.length - 1].end = moment.unix(key).format('HH:mm');
        searchStart = true;
      }
    }
  })

  const arr: any[] = [];
  timeEntries.forEach((item, index) => {
    arr.push({
      type: 'work',
      start: item.start,
      end: item.end,
      id: randomInt(1000000, 9999999),
      date: moment().format('YYYY-MM'),
    });
    if (timeEntries[index + 1]) {
      arr.push({
        type: 'break',
        start: item.end,
        end: timeEntries[index + 1].start,
        id: randomInt(1000000, 9999999),
        date: moment().format('YYYY-MM'),
      });
    }
  });
  return arr;
}




