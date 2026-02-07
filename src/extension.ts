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

// --- レイアウトタイプと ViewColumn の位置関係 ---
type LayoutType = 'vertical2' | 'horizontal2' | 'leftSplit3' | 'topSplit3' | '2x2';

/**
 * 各レイアウトタイプにおける、論理的なスロット位置と ViewColumn の対応を返す。
 * VS Code は深さ優先順で ViewColumn を割り当てるため、レイアウト構造から決定できる。
 */
function getLayoutSlotMapping(layoutType: LayoutType): Map<SlotName, vscode.ViewColumn> {
  const mapping = new Map<SlotName, vscode.ViewColumn>();

  switch (layoutType) {
    case 'vertical2':
      // [1: 上] [2: 下]
      mapping.set('topLeft', vscode.ViewColumn.One);
      mapping.set('bottomLeft', vscode.ViewColumn.Two);
      break;
    case 'horizontal2':
      // [1: 左] [2: 右]
      mapping.set('topLeft', vscode.ViewColumn.One);
      mapping.set('topRight', vscode.ViewColumn.Two);
      break;
    case 'leftSplit3':
      // [1: 左上] [3: 右（全高）]
      // [2: 左下]
      mapping.set('topLeft', vscode.ViewColumn.One);
      mapping.set('bottomLeft', vscode.ViewColumn.Two);
      mapping.set('topRight', vscode.ViewColumn.Three);
      break;
    case 'topSplit3':
      // [1: 左上] [2: 右上]
      // [3: 下（全幅）]
      mapping.set('topLeft', vscode.ViewColumn.One);
      mapping.set('topRight', vscode.ViewColumn.Two);
      mapping.set('bottomLeft', vscode.ViewColumn.Three);
      break;
    case '2x2':
      // [1: 左上] [3: 右上]
      // [2: 左下] [4: 右下]
      mapping.set('topLeft', vscode.ViewColumn.One);
      mapping.set('bottomLeft', vscode.ViewColumn.Two);
      mapping.set('topRight', vscode.ViewColumn.Three);
      mapping.set('bottomRight', vscode.ViewColumn.Four);
      break;
  }

  return mapping;
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
 * レイアウトを変更し、レイアウトタイプに基づいて slotMap を正しく再設定する。
 * 新しく作成されたスロットの一覧を返す。
 */
async function changeLayout(
  layout: EditorGroupLayout,
  layoutType: LayoutType,
): Promise<SlotName[]> {
  await setEditorLayout(layout);
  // レイアウト変更が反映されるまで待つ
  await new Promise((resolve) => setTimeout(resolve, 100));

  // レイアウトタイプに基づいて正しい ViewColumn マッピングを取得
  const correctMapping = getLayoutSlotMapping(layoutType);

  // 変更前に登録されていたスロットを記録
  const previousSlots = new Set(slotMap.keys());

  // slotMap を正しいマッピングで上書き（フィンガープリントに頼らない）
  slotMap.clear();
  for (const [slot, viewColumn] of correctMapping.entries()) {
    slotMap.set(slot, viewColumn);
  }

  // 新しく追加されたスロットを返す
  const newSlots: SlotName[] = [];
  for (const slot of correctMapping.keys()) {
    if (!previousSlots.has(slot)) {
      newSlots.push(slot);
    }
  }
  return newSlots;
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
      let layoutType: LayoutType;
      if (groupCount === 1) {
        targetLayout = getVertical2Layout();
        layoutType = 'vertical2';
      } else if (groupCount === 2) {
        // topRight が既に存在する場合（horizontal2）は topSplit3 を使用
        // （topRight の ViewColumn 2 を維持するため）
        // bottomLeft のみ追加する場合は leftSplit3
        if (slotMap.has('topRight')) {
          targetLayout = getTopSplit3Layout();
          layoutType = 'topSplit3';
        } else {
          targetLayout = getLeftSplit3Layout();
          layoutType = 'leftSplit3';
        }
      } else {
        targetLayout = get2x2Layout();
        layoutType = '2x2';
      }

      await changeLayout(targetLayout, layoutType);

      // changeLayout が slotMap を設定済みなので、直接フォーカス
      const bottomLeftCol = slotMap.get('bottomLeft');
      if (bottomLeftCol !== undefined) {
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
      let layoutType: LayoutType;
      if (groupCount === 1) {
        targetLayout = getHorizontal2Layout();
        layoutType = 'horizontal2';
      } else if (groupCount === 2) {
        // bottomLeft が既に存在する場合（vertical2）は leftSplit3 を使用
        // （bottomLeft の ViewColumn 2 を維持するため）
        // topRight のみ追加する場合は topSplit3
        if (slotMap.has('bottomLeft')) {
          targetLayout = getLeftSplit3Layout();
          layoutType = 'leftSplit3';
        } else {
          targetLayout = getTopSplit3Layout();
          layoutType = 'topSplit3';
        }
      } else {
        targetLayout = get2x2Layout();
        layoutType = '2x2';
      }

      await changeLayout(targetLayout, layoutType);

      // changeLayout が slotMap を設定済みなので、直接フォーカス
      const topRightCol = slotMap.get('topRight');
      if (topRightCol !== undefined) {
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
      await changeLayout(get2x2Layout(), '2x2');

      // changeLayout が slotMap を設定済みなので、直接フォーカス
      const bottomRightCol = slotMap.get('bottomRight');
      if (bottomRightCol !== undefined) {
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
