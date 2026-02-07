import * as vscode from 'vscode';

/**
 * エディターグループをショートカットキーで作成・フォーカスする拡張機能
 *
 * 各ショートカットキー(Ctrl+1〜4)で作成したエディターグループの viewColumn を
 * 記録し、以降はその viewColumn を使って直接フォーカスする。
 *
 * setEditorLayout は既存グループの viewColumn を振り直す場合があるため、
 * レイアウト変更時にはグループ内のタブ情報を使って再マッピングを行う。
 *
 * グリッド位置の目標:
 * [Ctrl+1: 左上] [Ctrl+3: 右上]
 * [Ctrl+2: 左下] [Ctrl+4: 右下]
 */

// エディターレイアウトの型定義
interface EditorGroupLayout {
  orientation?: number; // 0: 横, 1: 縦
  groups: (EditorGroupLayout | { size?: number })[];
  size?: number;
}

// --- グループの viewColumn を記録するマップ ---
type SlotName = 'topLeft' | 'bottomLeft' | 'topRight' | 'bottomRight';
const slotMap = new Map<SlotName, vscode.ViewColumn>();

// --- focusNthEditorGroup コマンド一覧 ---
const focusCommands: Record<number, string> = {
  1: 'workbench.action.focusFirstEditorGroup',
  2: 'workbench.action.focusSecondEditorGroup',
  3: 'workbench.action.focusThirdEditorGroup',
  4: 'workbench.action.focusFourthEditorGroup',
  5: 'workbench.action.focusFifthEditorGroup',
  6: 'workbench.action.focusSixthEditorGroup',
  7: 'workbench.action.focusSeventhEditorGroup',
  8: 'workbench.action.focusEighthEditorGroup',
};

/**
 * viewColumn に対応するグループが現在存在するかチェック
 */
function groupExists(viewColumn: vscode.ViewColumn): boolean {
  return vscode.window.tabGroups.all.some((g) => g.viewColumn === viewColumn);
}

/**
 * viewColumn のグループに直接フォーカス
 */
async function focusByViewColumn(viewColumn: vscode.ViewColumn): Promise<void> {
  const cmd = focusCommands[viewColumn];
  if (cmd) {
    await vscode.commands.executeCommand(cmd);
  }
}

/**
 * グループのタブ内容からフィンガープリント文字列を生成する。
 * タブの URI を結合した文字列で、グループの同一性を判定するために使う。
 */
function getGroupFingerprint(group: vscode.TabGroup): string {
  return group.tabs
    .map((tab) => {
      const input = tab.input;
      if (input && typeof input === 'object' && 'uri' in input) {
        return (input as { uri: vscode.Uri }).uri.toString();
      }
      return '';
    })
    .join('|');
}

/**
 * 全スロットの viewColumn → フィンガープリントのスナップショットを取得
 */
function snapshotSlots(): Map<SlotName, string> {
  const snapshot = new Map<SlotName, string>();
  for (const [slot, viewColumn] of slotMap.entries()) {
    const group = vscode.window.tabGroups.all.find((g) => g.viewColumn === viewColumn);
    if (group) {
      snapshot.set(slot, getGroupFingerprint(group));
    }
  }
  return snapshot;
}

/**
 * レイアウト変更後にフィンガープリントを使って slotMap を再マッピングする。
 * 既存グループの viewColumn が振り直されている場合、タブ内容が一致する
 * グループを探して viewColumn を更新する。
 */
function remapSlotsByFingerprint(snapshot: Map<SlotName, string>): void {
  const currentGroups = vscode.window.tabGroups.all;

  for (const [slot, oldFingerprint] of snapshot.entries()) {
    // 空のフィンガープリントはスキップ（タブなしのグループは区別できない）
    if (!oldFingerprint) continue;

    const oldCol = slotMap.get(slot);
    // 現在の viewColumn で一致するグループがあればそのまま
    const currentGroup = currentGroups.find((g) => g.viewColumn === oldCol);
    if (currentGroup && getGroupFingerprint(currentGroup) === oldFingerprint) {
      continue;
    }

    // viewColumn がずれた場合: フィンガープリントが一致するグループを探す
    const matchedGroup = currentGroups.find(
      (g) => getGroupFingerprint(g) === oldFingerprint,
    );
    if (matchedGroup) {
      slotMap.set(slot, matchedGroup.viewColumn);
    }
  }
}

// --- レイアウト定義 ---

function getVertical2Layout(): EditorGroupLayout {
  return {
    orientation: 1,
    groups: [{ size: 0.5 }, { size: 0.5 }],
  };
}

function getHorizontal2Layout(): EditorGroupLayout {
  return {
    orientation: 0,
    groups: [{ size: 0.5 }, { size: 0.5 }],
  };
}

function getLeftSplit3Layout(): EditorGroupLayout {
  return {
    orientation: 0,
    groups: [
      {
        orientation: 1,
        groups: [{ size: 0.5 }, { size: 0.5 }],
        size: 0.5,
      },
      { size: 0.5 },
    ],
  };
}

function getTopSplit3Layout(): EditorGroupLayout {
  return {
    orientation: 1,
    groups: [
      {
        orientation: 0,
        groups: [{ size: 0.5 }, { size: 0.5 }],
        size: 0.5,
      },
      { size: 0.5 },
    ],
  };
}

function get2x2Layout(): EditorGroupLayout {
  return {
    orientation: 0,
    groups: [
      {
        orientation: 1,
        groups: [{ size: 0.5 }, { size: 0.5 }],
        size: 0.5,
      },
      {
        orientation: 1,
        groups: [{ size: 0.5 }, { size: 0.5 }],
        size: 0.5,
      },
    ],
  };
}

// --- レイアウト操作 ---

async function getEditorLayout(): Promise<EditorGroupLayout | undefined> {
  try {
    return await vscode.commands.executeCommand('vscode.getEditorLayout');
  } catch {
    return undefined;
  }
}

async function setEditorLayout(layout: EditorGroupLayout): Promise<void> {
  await vscode.commands.executeCommand('vscode.setEditorLayout', layout);
}

function countGroups(layout: EditorGroupLayout | undefined): number {
  if (!layout) return 1;
  if (!layout.groups || layout.groups.length === 0) return 1;

  let count = 0;
  for (const group of layout.groups) {
    if ('groups' in group && group.groups && group.groups.length > 0) {
      count += countGroups(group as EditorGroupLayout);
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * レイアウトを変更し、新しく作成されたグループの viewColumn を返す。
 * 既存スロットの viewColumn が振り直された場合はタブ内容で再マッピングする。
 */
async function changeLayout(layout: EditorGroupLayout): Promise<vscode.ViewColumn[]> {
  // 変更前のタブ内容スナップショットを保存
  const snapshot = snapshotSlots();

  await setEditorLayout(layout);
  // レイアウト変更が反映されるまで待つ
  await new Promise((resolve) => setTimeout(resolve, 100));

  // タブ内容で既存スロットの viewColumn を再マッピング
  remapSlotsByFingerprint(snapshot);

  // 再マッピング後の slotMap に登録済みの viewColumn は新規ではない
  const registeredCols = new Set(slotMap.values());
  const newCols: vscode.ViewColumn[] = [];
  for (const group of vscode.window.tabGroups.all) {
    if (!registeredCols.has(group.viewColumn)) {
      newCols.push(group.viewColumn);
    }
  }
  return newCols;
}

/**
 * スロットに記録された viewColumn のグループがまだ存在するか確認し、
 * 存在すればフォーカスして true を返す。存在しなければ記録を消して false を返す。
 */
async function tryFocusSlot(slot: SlotName): Promise<boolean> {
  const viewColumn = slotMap.get(slot);
  if (viewColumn !== undefined && groupExists(viewColumn)) {
    await focusByViewColumn(viewColumn);
    return true;
  }
  // 存在しないグループの記録は消す
  slotMap.delete(slot);
  return false;
}

/**
 * 初期状態で topLeft スロットを記録（常に ViewColumn.One）
 */
function ensureTopLeftRegistered(): void {
  if (!slotMap.has('topLeft')) {
    slotMap.set('topLeft', vscode.ViewColumn.One);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Editor Group Grid extension is now active');

  // Ctrl+1: 左上にフォーカス（常に最初のグループ）
  const focusTopLeft = vscode.commands.registerCommand('editorGroupGrid.focusTopLeft', async () => {
    ensureTopLeftRegistered();
    await focusByViewColumn(vscode.ViewColumn.One);
  });

  // Ctrl+2: 左下にフォーカス、なければ作成
  const focusBottomLeft = vscode.commands.registerCommand(
    'editorGroupGrid.focusBottomLeft',
    async () => {
      ensureTopLeftRegistered();

      // 既にスロットに記録済みのグループが存在するなら、直接フォーカス
      if (await tryFocusSlot('bottomLeft')) {
        return;
      }

      // グループが存在しないので作成する
      const layout = await getEditorLayout();
      const groupCount = countGroups(layout);

      let targetLayout: EditorGroupLayout;
      if (groupCount === 1) {
        targetLayout = getVertical2Layout();
      } else if (groupCount === 2) {
        targetLayout = getLeftSplit3Layout();
      } else {
        targetLayout = get2x2Layout();
      }

      const newCols = await changeLayout(targetLayout);

      if (newCols.length > 0) {
        newCols.sort((a, b) => a - b);
        const bottomLeftCol = newCols[0];
        slotMap.set('bottomLeft', bottomLeftCol);
        await focusByViewColumn(bottomLeftCol);
      }
    },
  );

  // Ctrl+3: 右上にフォーカス、なければ作成
  const focusTopRight = vscode.commands.registerCommand(
    'editorGroupGrid.focusTopRight',
    async () => {
      ensureTopLeftRegistered();

      // 既にスロットに記録済みのグループが存在するなら、直接フォーカス
      if (await tryFocusSlot('topRight')) {
        return;
      }

      // グループが存在しないので作成する
      const layout = await getEditorLayout();
      const groupCount = countGroups(layout);

      let targetLayout: EditorGroupLayout;
      if (groupCount === 1) {
        targetLayout = getHorizontal2Layout();
      } else if (groupCount === 2) {
        targetLayout = getTopSplit3Layout();
      } else {
        targetLayout = get2x2Layout();
      }

      const newCols = await changeLayout(targetLayout);

      if (newCols.length > 0) {
        newCols.sort((a, b) => a - b);
        const topRightCol = newCols[0];
        slotMap.set('topRight', topRightCol);
        await focusByViewColumn(topRightCol);
      }
    },
  );

  // Ctrl+4: 右下にフォーカス、なければ作成
  const focusBottomRight = vscode.commands.registerCommand(
    'editorGroupGrid.focusBottomRight',
    async () => {
      ensureTopLeftRegistered();

      // 既にスロットに記録済みのグループが存在するなら、直接フォーカス
      if (await tryFocusSlot('bottomRight')) {
        return;
      }

      // グループが存在しないので 2x2 を作成
      const newCols = await changeLayout(get2x2Layout());

      if (newCols.length > 0) {
        newCols.sort((a, b) => a - b);
        const bottomRightCol = newCols[newCols.length - 1];
        slotMap.set('bottomRight', bottomRightCol);

        // 同時に作成された他のグループも未登録スロットに割り当て
        if (newCols.length >= 2) {
          const remainingCols = newCols.slice(0, -1);
          const unregisteredSlots: SlotName[] = [];
          if (!slotMap.has('bottomLeft')) unregisteredSlots.push('bottomLeft');
          if (!slotMap.has('topRight')) unregisteredSlots.push('topRight');

          for (let i = 0; i < Math.min(unregisteredSlots.length, remainingCols.length); i++) {
            slotMap.set(unregisteredSlots[i], remainingCols[i]);
          }
        }

        await focusByViewColumn(bottomRightCol);
      }
    },
  );

  // グループが閉じられたときに slotMap をクリーンアップ
  const onGroupChange = vscode.window.tabGroups.onDidChangeTabGroups(() => {
    for (const [slot, viewColumn] of slotMap.entries()) {
      if (!groupExists(viewColumn)) {
        slotMap.delete(slot);
      }
    }
  });

  context.subscriptions.push(
    focusTopLeft,
    focusBottomLeft,
    focusTopRight,
    focusBottomRight,
    onGroupChange,
  );
}

export function deactivate() {}
