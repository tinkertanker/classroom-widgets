// #228: real submissions/retries must retain only the displayed last five,
// without capping the independent counter or changing newest-first order/reset.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createStepLog, joinAsStudent, newTeacherContext, prepareEvidence, startStack } from './harness.mjs';

const evidence = prepareEvidence('activity-history', ['activity-history.txt', 'recent-responses.png']);
const { step, write } = createStepLog(join(evidence, 'activity-history.txt'));
let stack;
let browser;
const violations = [];

// DOM alone cannot distinguish bounded retention from the old slice-at-render
// implementation. Inspect the actual mounted component's response-array hook
// as a memory diagnostic, in addition to driving/asserting the public UI below.
async function retainedResponses(teacher, componentName) {
  return teacher.evaluate(name => {
    const element = document.querySelector('#root').firstElementChild;
    const key = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
    let root = element[key];
    while (root?.return) root = root.return;
    // DOM fiber references can point to the previous alternate after a commit.
    // Always inspect the root's currently committed tree.
    const pending = [root?.stateNode.current];
    while (pending.length) {
      const fiber = pending.pop();
      if (!fiber) continue;
      if (fiber.type?.name === name) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState;
          if (Array.isArray(value) && value.length && value.every(row =>
            typeof row.studentName === 'string' && typeof row.timestamp === 'number'
            && typeof row.score === 'number' && typeof row.total === 'number')) {
            return value.map(({ studentName, score, total }) => ({ studentName, score, total }));
          }
        }
        return [];
      }
      pending.push(fiber.child, fiber.sibling);
    }
    throw new Error(`Mounted ${name} component not found; memory diagnostic unavailable`);
  }, componentName);
}

try {
  stack = await startStack();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  for (const [name, component, template, correct] of [
    ['Fill in the Blanks', 'FillBlank', '{{moon}}', 'moon'],
    ['Code Fill-in-the-Blanks', 'CodeFillBlank', 'print({{42}})', '42']
  ]) {
    const context = await newTeacherContext(browser);
    const teacher = await context.newPage();
    await teacher.goto(stack.teacherUrl);
    await teacher.getByTitle('More widgets (⌘K)').click();
    await teacher.getByPlaceholder('Search widgets...').fill(name);
    await teacher.getByRole('dialog').getByText(name, { exact: true }).click();
    await teacher.getByRole('button', { name: 'Create Activity' }).click();
    await teacher.getByTitle('Settings', { exact: true }).click();
    await teacher.getByRole('dialog').locator('textarea').fill(template);
    await teacher.getByRole('button', { name: 'Save Activity' }).click();
    await teacher.getByTitle('Pause activity').waitFor();
    const code = (await teacher.locator('code').filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent()).trim();
    const names = ['Ada', 'Ben', 'Cy'];
    const students = [];
    for (const studentName of names) {
      const student = await joinAsStudent(browser, stack.studentUrl, code, studentName);
      student.on('console', message => {
        if (message.type() === 'error') step(`${name} ${studentName}: ${message.text()}`);
      });
      students.push(student);
    }
    const expected = [];
    const attempts = [0, 1, 2, 0, 2, 1, 0, 2];
    const used = new Set();
    for (const [index, studentIndex] of attempts.entries()) {
      const student = students[studentIndex];
      await student.bringToFront();
      if (used.has(studentIndex)) await student.getByRole('button', { name: 'Try Again' }).click();
      used.add(studentIndex);
      const submit = student.getByRole('button', { name: 'Check Answers' });
      await submit.waitFor();
      if (component === 'CodeFillBlank') {
        await student.getByPlaceholder('___', { exact: true }).fill(index % 2 === 0 ? correct : 'wrong');
      } else {
        const source = await student.getByRole('button', { name: correct, exact: true }).boundingBox();
        const target = await student.locator('span:has(> span:empty)').first().boundingBox();
        assert.ok(source && target, 'real draggable answer and empty drop zone are rendered');
        await student.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
        await student.mouse.down();
        await student.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
        await student.mouse.up();
        // dnd-kit suppresses document click events for 50ms after a drag.
        // Let that deliberate suppression expire before activating Submit.
        await student.waitForTimeout(100);
      }
      await submit.click();
      await student.getByRole('button', { name: 'Try Again' }).waitFor();
      await teacher.getByText(`${name} · ${index + 1} response${index ? 's' : ''}`, { exact: true }).waitFor();
      expected.push({ studentName: names[studentIndex], score: component === 'FillBlank' || index % 2 === 0 ? 1 : 0, total: 1 });
      const retained = await retainedResponses(teacher, component);
      const latest = expected.slice(-5);
      step(`${name} attempt${index + 1}: retained=${retained.length}, counter=${index + 1}`);
      if (JSON.stringify(retained) !== JSON.stringify(latest)) violations.push(`${name} attempt${index + 1}: retained history is not the exact latest five`);
      const rows = teacher.getByText('Recent Responses:', { exact: true }).locator('..').locator('div.space-y-1 > div');
      assert.deepEqual(await rows.locator('span:first-child').allTextContents(), latest.toReversed().map(row => row.studentName));
      assert.deepEqual(await rows.locator('span:last-child').allTextContents(), latest.toReversed().map(row => `${row.score}/${row.total}`));
    }
    await teacher.getByText(`${name} · 8 responses`, { exact: true }).hover();
    if (component === 'CodeFillBlank') await teacher.screenshot({ path: join(evidence, 'recent-responses.png') });
    await teacher.getByTitle('Reset responses').click();
    await teacher.getByText(`${name} · 0 responses`, { exact: true }).waitFor();
    await teacher.getByText('Recent Responses:', { exact: true }).waitFor({ state: 'hidden' });
    assert.deepEqual(await retainedResponses(teacher, component), []);
    step(`PASS ${name}: eight submissions from three students incl retries; exact recent rows/scores/newest-first, uncapped counter and reset`);
    for (const student of students) await student.close();
    await context.close();
  }
  assert.deepEqual(violations, [], 'retained response history must be bounded at insertion, not only render');
  step('PASS bounded activity response history');
} catch (error) {
  step(`FAIL: ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stack?.stop();
  write();
}
