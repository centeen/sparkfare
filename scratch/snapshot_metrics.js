// scratch/snapshot_metrics.js
// Run this script locally with Node.js to fetch from the local wrangler dev server and emit state_METRICS.md
import fs from 'node:fs';

async function main() {
  const adminSecret = process.env.ADMIN_SECRET || 'dev-secret';
  const url = `http://127.0.0.1:8787/admin/metrics?secret=${adminSecret}`;
  
  console.log(`Fetching metrics from ${url}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch metrics: ${res.status} ${res.statusText}`);
      process.exit(1);
    }
    
    const data = await res.json();
    
    // Generate the markdown
    let md = `# State: Metrics & KPIs\n\nGenerated at: ${data.generated_at}\n\n`;
    
    // Overall Stats
    md += `## Acquisition & Viral\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Total Users | ${data.acquisition.total_users} |\n`;
    md += `| Verified Users | ${data.acquisition.verified_users} |\n`;
    md += `| Active Subscribers | ${data.acquisition.active_subscribers} |\n`;
    md += `| Referred Signups | ${data.viral.referred_signups} |\n`;
    md += `| Unique Referrers | ${data.viral.unique_referrers} |\n`;
    md += `| Viral Coefficient | ${data.viral.viral_coefficient.toFixed(2)} |\n\n`;
    
    // Weekly Events Rollup
    md += `## Weekly Events (Rollup)\n\n`;
    md += `| Week | Signups | Emails Sent | Opens | Clicks | Open Rate | Click Rate |\n|---|---|---|---|---|---|---|\n`;
    if (data.weekly_events && data.weekly_events.length > 0) {
      data.weekly_events.forEach(row => {
        const openRate = row.emails_sent > 0 ? ((row.email_opens / row.emails_sent) * 100).toFixed(1) + '%' : 'N/A';
        const clickRate = row.emails_sent > 0 ? ((row.email_clicks / row.emails_sent) * 100).toFixed(1) + '%' : 'N/A';
        md += `| ${row.week} | ${row.signups} | ${row.emails_sent} | ${row.email_opens} | ${row.email_clicks} | ${openRate} | ${clickRate} |\n`;
      });
    } else {
      md += `| not available | | | | | | |\n`;
    }
    md += `\n`;
    
    // Cohorts
    md += `## 14-Day Engagement Cohorts\n\n`;
    md += `| Signup Week | Cohort Size | Engaged (14d) | Engagement Rate |\n|---|---|---|---|\n`;
    if (data.cohorts && data.cohorts.length > 0) {
      data.cohorts.forEach(row => {
        const rate = row.cohort_size > 0 ? ((row.engaged_users / row.cohort_size) * 100).toFixed(1) + '%' : 'N/A';
        md += `| ${row.signup_week} | ${row.cohort_size} | ${row.engaged_users} | ${rate} |\n`;
      });
    } else {
      md += `| not available | | | |\n`;
    }
    md += `\n`;

    // Outbound Clicks
    md += `## Outbound Clicks by Partner\n\n`;
    md += `| Week | Partner | Clicks |\n|---|---|---|\n`;
    if (data.outbound_clicks && data.outbound_clicks.length > 0) {
      data.outbound_clicks.forEach(row => {
        md += `| ${row.week} | ${row.partner} | ${row.clicks} |\n`;
      });
    } else {
      md += `| not available | | |\n`;
    }
    md += `\n`;
    
    fs.writeFileSync('state_METRICS.md', md, 'utf-8');
    console.log('Successfully wrote state_METRICS.md');
    
  } catch (err) {
    console.error('Error snapshotting metrics:', err);
    process.exit(1);
  }
}

main();
