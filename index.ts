// import {
//   JupyterFrontEnd,
//   JupyterFrontEndPlugin
// } from '@jupyterlab/application';

// /**
//  * Initialization data for the jupyterlab_status_bar extension.
//  */
// const plugin: JupyterFrontEndPlugin<void> = {
//   id: 'jupyterlab_status_bar:plugin',
//   autoStart: true,
//   activate: (app: JupyterFrontEnd) => {
//     console.log('JupyterLab extension jupyterlab_status_bar is activated!');
//   }
// };

// export default plugin;

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  CodeCell
} from '@jupyterlab/cells';

import {
  IShellMessage
} from '@jupyterlab/services/lib/kernel/messages';

import {
  StatusBar
} from '@jupyterlab/statusbar';

import { DocumentWidget } from '@jupyterlab/docregistry';
import { NotebookPanel } from '@jupyterlab/notebook';
// import { Widget } from '@lumino/widgets';
import { Kernel } from '@jupyterlab/services';

class CellExecutionTimeWidget extends StatusBar {
  private _startTimes: WeakMap<CodeCell, number>;
  private _endTimes: WeakMap<CodeCell, number>;
  private _label: HTMLDivElement;
  
  constructor() {
    super();
    this._startTimes = new WeakMap<CodeCell, number>();
    this._endTimes = new WeakMap<CodeCell, number>();
    this._label = document.createElement('div');
    this._label.textContent = 'Execution time: N/A';
    this.node.appendChild(this._label);
  }

  private _onShellMessage(sender: CodeCell, message: IShellMessage) {
    if (message.header.msg_type === 'execute_reply' && this._startTimes.has(sender)) {
      const startTime = this._startTimes.get(sender);
      const endTime = new Date().getTime();
      const executionTime = endTime - startTime!;
      this._endTimes.set(sender, endTime);
      this._updateLabel(executionTime);
    }
  }

  private _onActiveCellChanged() {
    const activeCell = (this.parent as any)?.content.activeCell;
    if (!activeCell || !(activeCell instanceof CodeCell)) {
      return;
    }
    if (!this._startTimes.has(activeCell)) {
      this._startTimes.set(activeCell, new Date().getTime());
      this._updateLabel(null);
    }
    if (this._endTimes.has(activeCell)) {
      const executionTime = this._endTimes.get(activeCell)! - this._startTimes.get(activeCell)!;
      this._updateLabel(executionTime);
    }
  }

  private _updateLabel(executionTime: number | null) {
    if (executionTime === null) {
      this._label.textContent = 'Execution time: N/A';
    } else {
      const seconds = (executionTime / 1000).toFixed(2);
      this._label.textContent = `Execution time: ${seconds} s`;
    }
  }

  protected onAfterAttach(): void {
    const docWidget = this.parent as DocumentWidget;
    const content = docWidget.content as NotebookPanel;
    content.content.activeCellChanged.connect(this._onActiveCellChanged, this);
  
    if (content.sessionContext) {
      const kernel = content.sessionContext.session?.kernel;
      if (kernel) {
        kernel.statusChanged.connect(this._onKernelStatusChanged, this);
      }
    }
  }
  
  private _onKernelStatusChanged(_: Kernel.IKernelConnection, status: Kernel.Status) {
    if (status === "idle") {
      const activeCell = this._getActiveCodeCell();
      if (activeCell && this._startTimes.has(activeCell)) {
        const startTime = this._startTimes.get(activeCell)!;
        const endTime = new Date().getTime();
        const executionTime = endTime - startTime;
        this._endTimes.set(activeCell, endTime);
        this._updateLabel(executionTime);
      }
    }
  }
  
  private _getActiveCodeCell(): CodeCell | null {
    const docWidget = this.parent as NotebookPanel;
    const activeCell = docWidget.content.activeCell;
    return activeCell instanceof CodeCell ? activeCell : null;
  }

  protected onBeforeDetach() {
    const docWidget = this.parent as NotebookPanel;
    if (!docWidget) {
      return;
    }
    docWidget.content.activeCellChanged.disconnect(this._onActiveCellChanged, this);
    // CodeCell.executeSucceeded.disconnect(this._onShellMessage, this);
    const cells = docWidget.content.widgets;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.model.type === 'code') {
        cell.model.executionCountChanged.disconnect(this._onShellMessage, this);
      }
    }
  }
}
/**
 * Initialization data for the jupyterlab-cell-execution-time extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-cell-execution-time',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    const widget = new CellExecutionTimeWidget();
    app.docRegistry.addWidgetExtension('Notebook', widget);
  }
};

export default extension;
