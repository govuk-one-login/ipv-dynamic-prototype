import {
  AskOutcome,
  CapabilityQuestion,
  CapabilityQuestionKind,
  CriGroup,
  CriId,
  CriOption,
  DocumentAccess,
  DocumentType,
  Evidence,
  Gpg45Scores,
  RouteQuestion,
  ScoreType,
  TargetProfiles,
  UserCapabilities,
  VerifiableCredential
} from './shared/types';
import { CriAvailability, CriAvailabilityResult, findCri } from './engine/engine';
import { evidenceIsSatisfactory, resolveScores } from './shared/gpg45';
import { isFinalAnswer } from './shared/capabilities';

const WIDTH = 92;

// Colour is dropped when the output is not a terminal, so piped runs stay readable.
const colourful = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

const colour = (open: number) => (text: string): string =>
  colourful ? `\u001b[${open}m${text}\u001b[0m` : text;

export const bold = colour(1);
export const dim = colour(2);
export const red = colour(31);
export const green = colour(32);
export const amber = colour(33);
export const blue = colour(34);
export const magenta = colour(35);
export const cyan = colour(36);

const ANSI = /\u001b\[[0-9;]*m/g;

const plain = (text: string): string => text.replace(ANSI, '');

const visibleWidth = (text: string): number => [...plain(text)].length;

const pad = (text: string, to: number, align: 'left' | 'right' = 'left'): string => {
  const fill = ' '.repeat(Math.max(0, to - visibleWidth(text)));
  return align === 'right' ? `${fill}${text}` : `${text}${fill}`;
};

const truncate = (text: string, to: number): string =>
  visibleWidth(text) <= to ? text : `${[...text].slice(0, to - 1).join('')}…`;

export interface Column {
  header: string;
  align?: 'left' | 'right';
}

// Aligns every cell to the widest value in its column, ignoring colour codes.
export const table = (columns: Column[], rows: string[][]): string[] => {
  const widths = columns.map((column, index) =>
    Math.max(visibleWidth(column.header), ...rows.map(row => visibleWidth(row[index] ?? '')))
  );

  const line = (cells: string[]): string =>
    `  ${cells
      .map((cell, index) => pad(cell ?? '', widths[index], columns[index].align))
      .join('  ')
      .trimEnd()}`;

  const separator = columns.map((column, index) =>
    column.header === '' ? ' '.repeat(widths[index]) : '─'.repeat(widths[index])
  );

  return [
    dim(line(columns.map(column => column.header))),
    dim(line(separator)),
    ...rows.map(line)
  ];
};

export const banner = (left: string, right = ''): string => {
  const head = `═══ ${left} `;
  const tail = right === '' ? '' : ` ${right} ═══`;
  const fill = '═'.repeat(Math.max(3, WIDTH - visibleWidth(head) - visibleWidth(tail)));

  return `\n${bold(blue(`${head}${fill}${tail}`))}`;
};

export const rule = (title: string): string => {
  const head = `── ${title} `;
  return `\n${cyan(head)}${dim('─'.repeat(Math.max(0, WIDTH - visibleWidth(head))))}`;
};

export const decision = (text: string): string => `\n${bold(magenta(`▸ ENGINE  ${text}`))}`;

export const prompt = (text: string): string => `\n${bold(amber(`➡  ${text}`))}`;

export const question = (text: string): string => `\n${bold(text)}`;

export const cursor = (): string => bold(cyan('> '));

export const halt = (text: string): string => `\n${bold(red(`▪ CORE-FRONT  ${text}`))}`;

export const warn = (text: string): string => red(text);

const SCORES: { type: ScoreType; label: string }[] = [
  { type: ScoreType.STRENGTH, label: 'S' },
  { type: ScoreType.VALIDITY, label: 'V' },
  { type: ScoreType.ACTIVITY, label: 'A' },
  { type: ScoreType.FRAUD, label: 'F' },
  { type: ScoreType.VERIFICATION, label: 'Ve' }
];

const SCORE_COLUMNS: Column[] = SCORES.map(({ label }) => ({ header: label, align: 'right' }));

const scoreCells = (scores: Partial<Record<ScoreType, number>>): string[] =>
  SCORES.map(({ type }) => {
    const score = scores[type];
    return score === undefined ? dim('·') : score === 0 ? dim('0') : String(score);
  });

const SINGLE_SCORES = [
  { key: 'activity', label: 'A' },
  { key: 'fraud', label: 'F' },
  { key: 'verification', label: 'Ve' }
] as const;

const evidenceLabel = (evidence: Evidence): string => `${evidence.strength}/${evidence.validity}`;

const evidencesLabel = (evidences: Evidence[]): string => evidences.map(evidenceLabel).join(' + ');

export const identityScores = (current: Gpg45Scores, targets: TargetProfiles): string[] => {
  const held = SINGLE_SCORES.map(({ key }) =>
    current[key] === 0 ? dim('0') : bold(String(current[key]))
  );

  const rows: string[][] = [
    [
      bold('you have'),
      current.evidences.length === 0 ? dim('none') : bold(evidencesLabel(current.evidences)),
      ...held,
      ''
    ]
  ];

  for (const [name, profile] of Object.entries(targets)) {
    const evidenceMet = evidenceIsSatisfactory(profile.evidences, current.evidences);
    const required = evidencesLabel(profile.evidences);

    const cells = SINGLE_SCORES.map(({ key }) => {
      if (profile[key] === 0) return dim('·');
      return current[key] >= profile[key] ? green(String(profile[key])) : red(String(profile[key]));
    });

    const short = [
      ...(evidenceMet ? [] : [red(`S/V ${required}`)]),
      ...SINGLE_SCORES.filter(({ key }) => current[key] < profile[key]).map(({ key, label }) =>
        red(`${label} ${profile[key]}`)
      )
    ];

    const status = short.length === 0 ? green('✔ met') : dim('short of ') + short.join(dim(', '));

    rows.push([dim(name), evidenceMet ? green(required) : red(required), ...cells, status]);
  }

  return table(
    [
      { header: 'profile' },
      { header: 'S/V' },
      ...SINGLE_SCORES.map(({ label }) => ({ header: label, align: 'right' as const })),
      { header: '' }
    ],
    rows
  );
};

export const credentials = (stored: VerifiableCredential[]): string[] => {
  if (stored.length === 0) return [dim('  empty — no credentials issued yet')];

  const rows = stored.map((credential, index) => [
    dim(String(index + 1)),
    credential.cri,
    credential.successful ? green('✔') : red('✘'),
    truncate(credential.check, 36),
    credential.document ?? dim('—'),
    ...scoreCells(resolveScores(credential)),
    credential.collected.length === 0
      ? dim('—')
      : dim(credential.collected.join(' ')),
    credential.contraIndicators.length === 0
      ? dim('—')
      : red(credential.contraIndicators.join(' '))
  ]);

  return table(
    [
      { header: '#', align: 'right' },
      { header: 'cri' },
      { header: '' },
      { header: 'check' },
      { header: 'document' },
      ...SCORE_COLUMNS,
      { header: 'collected' },
      { header: 'cis' }
    ],
    rows
  );
};

const AVAILABILITY: Record<CriAvailability, { icon: string; label: string; paint: (text: string) => string }> = {
  [CriAvailability.FORCED]: { icon: '★', label: 'forced', paint: magenta },
  [CriAvailability.AVAILABLE]: { icon: '✔', label: 'available', paint: green },
  [CriAvailability.NEEDS_ANSWER]: { icon: '!', label: 'ask first', paint: blue },
  [CriAvailability.UNKNOWN]: { icon: '?', label: 'unasked', paint: amber },
  [CriAvailability.RECONSIDER]: { icon: '↻', label: 'second chance', paint: cyan },
  [CriAvailability.UNAVAILABLE]: { icon: '✘', label: 'ruled out', paint: red }
};

const stateLegend = (): string =>
  `  ${[
    magenta('★ forced'),
    green('✔ available'),
    blue('! ask first'),
    amber('? unasked'),
    cyan('↻ second chance'),
    red('✘ ruled out'),
    dim('· attempted')
  ].join(dim('  ·  '))}`;

const GROUPS = Object.values(CriGroup);

export const availability = (
  results: CriAvailabilityResult[],
  attempted: CriId[]
): string[] => {
  // Grouped because `group` is what scopes forcing: everything in a group with a forced
  // member is closed off, and nothing outside it is touched. Within a group the rows are
  // ordered by weight, which is the order the engine prefers them in.
  const grouped = GROUPS.map(group => ({
    group,
    members: results
      .filter(result => result.cri.group === group)
      .sort((a, b) => a.cri.weight - b.cri.weight)
  })).filter(({ members }) => members.length > 0);

  const toRow = (result: CriAvailabilityResult): string[] => {
    const done = attempted.includes(result.cri.id);
    const { icon, label, paint } = AVAILABILITY[result.availability];
    // Colour codes cannot nest, so an attempted row is flattened before being dimmed.
    const faint = (cell: string) => dim(plain(cell));

    return [
      done ? faint(result.cri.id) : result.cri.id,
      dim(String(result.cri.weight)),
      done ? dim('·') : paint(icon),
      done ? dim('attempted') : paint(label),
      ...scoreCells(maxOf(result)).map(cell => (done ? faint(cell) : cell)),
      dim(truncate(result.reason ?? '', 46))
    ];
  };

  const [header, separator, ...rows] = table(
    [
      { header: 'cri' },
      { header: 'wt', align: 'right' },
      { header: '' },
      { header: 'status' },
      ...SCORE_COLUMNS,
      { header: 'why' }
    ],
    grouped.flatMap(({ members }) => members.map(toRow))
  );

  const lines = [stateLegend(), '', `  ${header}`, `  ${separator}`];
  let index = 0;

  for (const { group, members } of grouped) {
    const forced = members.find(member => member.availability === CriAvailability.FORCED);
    const note = forced ? dim(` — ${forced.cri.id} forced, rest of the group closed`) : '';

    lines.push(`  ${bold(cyan(group))}${note}`);
    lines.push(...rows.slice(index, index + members.length).map(row => `  ${row}`));
    index += members.length;
  }

  return lines;
};

// The best each CRI could award, so the availability table doubles as a view of what is
// still on the table score-wise.
const maxOf = (result: CriAvailabilityResult): Partial<Record<ScoreType, number>> => {
  const scores: Partial<Record<ScoreType, number>> = {};

  for (const check of result.cri.provides) {
    for (const [type, score] of Object.entries(resolveScores(check))) {
      const key = type as ScoreType;
      scores[key] = Math.max(scores[key] ?? 0, score as number);
    }
  }

  return scores;
};

const answer = (value: boolean | undefined, final = false): string =>
  value === undefined
    ? dim('not asked')
    : value
      ? green('yes')
      : final
        ? red('no — confirmed twice')
        : red('no');

export const capabilities = (bundle: UserCapabilities): string[] => {
  const final = (question: CapabilityQuestion) => isFinalAnswer(bundle, question);

  const rows: string[][] = [
    ['residency', bundle.residency === undefined ? dim('not asked') : cyan(bundle.residency)],
    [
      'device',
      bundle.device === undefined
        ? dim('not asked')
        : final({ kind: CapabilityQuestionKind.DEVICE })
          ? red(`${bundle.device} — confirmed twice`)
          : cyan(bundle.device)
    ],
    ...Object.values(DocumentAccess).map(access => [
      access,
      answer(
        bundle.documents[access],
        final({ kind: CapabilityQuestionKind.DOCUMENT_ACCESS, documentAccess: access })
      )
    ]),
    ...Object.values(DocumentType)
      .filter(type => bundle.documentTypes[type] !== undefined)
      .map(type => [
        type,
        answer(
          bundle.documentTypes[type],
          final({ kind: CapabilityQuestionKind.DOCUMENT_TYPE, documentType: type })
        )
      ]),
    ...Object.entries(bundle.additionalAnswers).map(([criId, index]) => {
      const asked = findCri(criId as CriId).askQuestions;
      const chosen = asked?.answers[index] ?? String(index);
      return [`${criId} question`, index === 0 ? green(chosen) : red(chosen)];
    })
  ];

  return table([{ header: 'capability' }, { header: 'answer' }], rows);
};

// The CRIs the engine offered for this step, in its order, with any question that has to
// be answered before the user can be sent there.
export const options = (offered: CriOption[]): string[] => {
  const rows = offered.map((option, index) => [
    dim(String(index + 1)),
    option.criId,
    option.document ?? dim('—'),
    option.question === undefined ? dim('nothing to ask') : blue(option.question.question)
  ]);

  return table(
    [
      { header: '#', align: 'right' },
      { header: 'cri' },
      { header: 'document' },
      { header: 'before redirecting' }
    ],
    rows
  );
};

const redirectTargets = (offered: CriOption[]): string =>
  offered.map(option => option.criId).join(' / ');

export const routeQuestions = (questions: RouteQuestion[], otherwise: AskOutcome): string[] => {
  const rows = questions.map((entry, index) => [
    dim(String(index + 1)),
    entry.criId,
    green(entry.achieves),
    ...scoreCells(entry.scores),
    entry.document ?? dim('—'),
    entry.retry === true ? cyan('↻ second chance') : dim('—'),
    entry.onYes === undefined
      ? amber('ask engine again')
      : green(`redirect → ${redirectTargets(entry.onYes)}`)
  ]);

  const outcome =
    'options' in otherwise
      ? green(`redirect → ${redirectTargets(otherwise.options)}`)
      : red(`stop — ${otherwise.message}`);

  return [
    ...table(
      [
        { header: '#', align: 'right' },
        { header: 'unlocks' },
        { header: 'reaches' },
        ...SCORE_COLUMNS,
        { header: 'document' },
        { header: '' },
        { header: 'on yes' }
      ],
      rows
    ),
    '',
    `  ${dim('every answer no:')} ${outcome}`
  ];
};

export const checkOptions = (
  options: { label: string; document?: DocumentType; scores: Partial<Record<ScoreType, number>> ; successful: boolean }[]
): string[] => {
  const rows = options.map(option => [
    option.successful ? green('✔') : red('✘'),
    option.label,
    option.document ?? dim('—'),
    ...scoreCells(option.scores)
  ]);

  // Rendered without headers or indent so it reads as a menu rather than a table.
  return table(
    [{ header: '' }, { header: '' }, { header: '' }, ...SCORE_COLUMNS.map(() => ({ header: '', align: 'right' as const }))],
    rows
  )
    .slice(2)
    .map(line => line.slice(2));
};

export const print = (lines: string[]): void => {
  for (const line of lines) console.log(line);
};
