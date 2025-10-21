import { FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

class DigiKopTestReporter implements Reporter {
  private results: Array<{
    test: string;
    suite: string;
    status: string;
    duration: number;
    error?: string;
    browser?: string;
  }> = [];

  onTestEnd(test: TestCase, result: TestResult) {
    this.results.push({
      test: test.title,
      suite: test.parent.title,
      status: result.status,
      duration: result.duration,
      error: result.error?.message,
      browser: test.parent.project()?.name
    });
  }

  onEnd(result: FullResult) {
    this.generateReport();
    this.generatePerformanceReport();
    this.generateCoverageReport();
  }

  private generateReport() {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'passed').length,
      failed: this.results.filter(r => r.status === 'failed').length,
      skipped: this.results.filter(r => r.status === 'skipped').length,
      flaky: this.results.filter(r => r.status === 'flaky').length,
      totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0)
    };

    const reportData = {
      summary,
      timestamp: new Date().toISOString(),
      results: this.results,
      suites: this.groupResultsBySuite(),
      browsers: this.groupResultsByBrowser()
    };

    const reportPath = path.join('test-results', 'digikop-e2e-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    this.generateHtmlReport(reportData);

    console.log('\n📊 DigiKop E2E Test Report');
    console.log('==========================');
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⏭️  Skipped: ${summary.skipped}`);
    console.log(`🔄 Flaky: ${summary.flaky}`);
    console.log(`⏱️  Total Duration: ${(summary.totalDuration / 1000).toFixed(2)}s`);
    console.log(`📈 Success Rate: ${((summary.passed / summary.total) * 100).toFixed(1)}%`);
  }

  private generatePerformanceReport() {
    const performanceTests = this.results.filter(r => 
      r.suite.toLowerCase().includes('performance') || 
      r.test.toLowerCase().includes('performance')
    );

    if (performanceTests.length === 0) return;

    const performanceData = {
      timestamp: new Date().toISOString(),
      tests: performanceTests.map(test => ({
        name: test.test,
        duration: test.duration,
        status: test.status,
        browser: test.browser
      })),
      averageDuration: performanceTests.reduce((sum, t) => sum + t.duration, 0) / performanceTests.length,
      slowestTest: performanceTests.reduce((slowest, current) => 
        current.duration > slowest.duration ? current : slowest
      )
    };

    const perfReportPath = path.join('test-results', 'performance-report.json');
    fs.writeFileSync(perfReportPath, JSON.stringify(performanceData, null, 2));

    console.log('\n🚀 Performance Test Summary');
    console.log('===========================');
    console.log(`Average Duration: ${(performanceData.averageDuration / 1000).toFixed(2)}s`);
    console.log(`Slowest Test: ${performanceData.slowestTest.test} (${(performanceData.slowestTest.duration / 1000).toFixed(2)}s)`);
  }

  private generateCoverageReport() {
    const suitesCovered = new Set(this.results.map(r => r.suite));
    const userJourneys = [
      'Authentication Flow',
      'Project Workflow', 
      'Map Interactions',
      'Moratorium Management',
      'User Management',
      'Performance Tests'
    ];

    const coverage = {
      totalSuites: userJourneys.length,
      coveredSuites: userJourneys.filter(journey => suitesCovered.has(journey)).length,
      coverage: (userJourneys.filter(journey => suitesCovered.has(journey)).length / userJourneys.length) * 100,
      missingSuites: userJourneys.filter(journey => !suitesCovered.has(journey))
    };

    console.log('\n📋 Test Coverage Summary');
    console.log('========================');
    console.log(`User Journey Coverage: ${coverage.coverage.toFixed(1)}%`);
    if (coverage.missingSuites.length > 0) {
      console.log(`Missing Coverage: ${coverage.missingSuites.join(', ')}`);
    }
  }

  private groupResultsBySuite() {
    const suites: Record<string, any> = {};
    
    this.results.forEach(result => {
      if (!suites[result.suite]) {
        suites[result.suite] = {
          name: result.suite,
          tests: [],
          passed: 0,
          failed: 0,
          skipped: 0,
          totalDuration: 0
        };
      }
      
      suites[result.suite].tests.push(result);
      suites[result.suite][result.status]++;
      suites[result.suite].totalDuration += result.duration;
    });

    return Object.values(suites);
  }

  private groupResultsByBrowser() {
    const browsers: Record<string, any> = {};
    
    this.results.forEach(result => {
      const browser = result.browser || 'unknown';
      if (!browsers[browser]) {
        browsers[browser] = {
          name: browser,
          passed: 0,
          failed: 0,
          skipped: 0,
          total: 0
        };
      }
      
      browsers[browser][result.status]++;
      browsers[browser].total++;
    });

    return Object.values(browsers);
  }

  private generateHtmlReport(data: any) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>DigiKop E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .suite { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .suite-header { background: #e9ecef; padding: 15px; font-weight: bold; }
        .test { padding: 10px 15px; border-bottom: 1px solid #eee; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #6c757d; }
        .error { background: #f8d7da; padding: 10px; margin-top: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>DigiKop E2E Test Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Tests:</strong> ${data.summary.total}</p>
        <p><strong>Passed:</strong> <span class="passed">${data.summary.passed}</span></p>
        <p><strong>Failed:</strong> <span class="failed">${data.summary.failed}</span></p>
        <p><strong>Skipped:</strong> <span class="skipped">${data.summary.skipped}</span></p>
        <p><strong>Success Rate:</strong> ${((data.summary.passed / data.summary.total) * 100).toFixed(1)}%</p>
        <p><strong>Total Duration:</strong> ${(data.summary.totalDuration / 1000).toFixed(2)}s</p>
        <p><strong>Generated:</strong> ${data.timestamp}</p>
    </div>
    
    ${data.suites.map((suite: any) => `
        <div class="suite">
            <div class="suite-header">${suite.name}</div>
            ${suite.tests.map((test: any) => `
                <div class="test">
                    <span class="${test.status}">${test.test}</span>
                    <span style="float: right;">${(test.duration / 1000).toFixed(2)}s</span>
                    ${test.error ? `<div class="error">${test.error}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}
</body>
</html>`;

    const htmlReportPath = path.join('test-results', 'digikop-e2e-report.html');
    fs.writeFileSync(htmlReportPath, html);
  }
}

export default DigiKopTestReporter;