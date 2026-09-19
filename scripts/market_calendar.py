"""Build an accessible calendar from Blue Koi's confirmed market appearances."""
import calendar
import json
from datetime import date
from html import escape
from pathlib import Path


def load_schedule():
    return json.loads((Path(__file__).resolve().parents[1] / 'content/markets.json').read_text(encoding='utf-8'))


def appearances(schedule, day):
    entries = []
    for market in schedule['markets']:
        if market['start_date'] <= day.isoformat() <= market['end_date'] and day.weekday() == market['weekday']:
            entries.append({**market, 'absent': day.isoformat() in market['excluded_dates']})
    return entries


def render_market_calendar():
    schedule = load_schedule()
    year = schedule['year']
    months = []
    e = escape
    for month in range(schedule['first_month'], schedule['last_month'] + 1):
        title = f'{calendar.month_name[month]} {year}'
        rows, visits = [], []
        for week in calendar.Calendar(firstweekday=6).monthdayscalendar(year, month):
            cells = []
            for number in week:
                if not number:
                    cells.append('<td class="calendar-empty"></td>')
                    continue
                day = date(year, month, number)
                events = appearances(schedule, day)
                marker, cell_class = '', ''
                for event in events:
                    absent = event['absent']
                    cell_class = 'calendar-away' if absent else 'calendar-' + event['id']
                    status = 'Not attending' if absent else event['name'] + ', ' + event['start_time'] + '–' + event['end_time']
                    marker += f'<span class="calendar-marker" aria-hidden="true">{"Away" if absent else e(event["short_name"])}</span><span class="calendar-screenreader">{e(status)}</span>'
                    event_text = 'Not attending the market' if absent else e(event['name'])
                    time_text = 'We’ll be back November 21.' if absent else event['start_time'] + '–' + event['end_time']
                    visits.append(f'<li class="visit-{event["id"]}{" visit-away" if absent else ""}"><time datetime="{day.isoformat()}">{day.strftime("%a")} {calendar.month_abbr[month]} {number}</time><div><strong>{event_text}</strong><span>{time_text}</span></div></li>')
                cells.append(f'<td class="{cell_class}"><time datetime="{day.isoformat()}">{number}</time>{marker}</td>')
            rows.append('<tr>' + ''.join(cells) + '</tr>')
        headers = ''.join(f'<th scope="col"><abbr title="{name}">{name[:3]}</abbr></th>' for name in ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
        months.append(f'<section class="market-month" data-calendar-month="{year}-{month:02d}" data-calendar-title="{title}"><div><table class="market-month-grid"><caption>{title}</caption><thead><tr>{headers}</tr></thead><tbody>{"".join(rows)}</tbody></table><p class="calendar-legend"><span class="legend-park">Park</span><span class="legend-city">City</span><span class="legend-away">Away</span></p></div><div class="market-date-list"><h3>{calendar.month_name[month]} visits</h3><ul>{"".join(visits)}</ul></div></section>')
    return f'<div class="market-calendar" data-market-calendar><div class="calendar-toolbar"><p class="eyebrow">Our 2026 market calendar</p><div class="calendar-controls" hidden><button type="button" data-calendar-previous aria-label="Previous month">←</button><span data-calendar-heading aria-live="polite" aria-atomic="true"></span><button type="button" data-calendar-next aria-label="Next month">→</button></div></div><p class="calendar-timezone">All times are local to Charlottesville (Eastern Time).</p>{"".join(months)}<p class="calendar-season-note">We won’t be at the market November 7 or 14. Our last scheduled market of 2026 is December 19.</p></div>'
