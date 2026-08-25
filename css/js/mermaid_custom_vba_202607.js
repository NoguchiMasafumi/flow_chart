mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  flowchart: {
    nodeSpacing: 110,
    rankSpacing: 50
  }
});

// 半直線 p1->p2 と 線分 p3-p4 の交点を計算する幾何学関数
function lineIntersection(p1, p2, p3, p4) {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
  if (t >= 0 && u >= -0.01 && u <= 1.01) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };
  }
  return null;
}

window.addEventListener('DOMContentLoaded', async () => {
  await mermaid.run();

  const TARGET_RECT_WIDTH = 240;
  const RHOMBUS_FLAT_FACTOR = 0.45;
  const RHOMBUS_TEXT_OFFSET_X = 0;

  // 1. ノード種別ごとの配置・幅補正
  document.querySelectorAll('.node').forEach(node => {
    const polygon = node.querySelector('polygon');
    const rawNodeId = node.id || '';
    
    const cleanId = rawNodeId.replace(/^flowchart-/, '').replace(/-\d+$/, '');
    const isStartEnd = /^(Start|End|ExitSub)$/i.test(cleanId);
    const rectElem = node.querySelector('rect');
    const isStadium = isStartEnd || (rectElem && rectElem.getAttribute('rx') && parseFloat(rectElem.getAttribute('rx')) > 0) || !!node.querySelector('path:not(.edgePath path)');

    // ■ 1. スタジアム型（開始・終了）ノード
    if (isStadium) {
      const shape = node.querySelector('path, rect');
      if (!shape) return;
      const bbox = shape.getBBox();
      const labelGroup = node.querySelector('g.label');
      const fo = node.querySelector('foreignObject');

      if (fo) {
        if (labelGroup) {
          labelGroup.removeAttribute('transform');
          labelGroup.style.transform = 'none';
        }
        fo.setAttribute('x', bbox.x);
        fo.setAttribute('y', bbox.y);
        fo.setAttribute('width', bbox.width);
        fo.setAttribute('height', bbox.height);
        fo.style.width = bbox.width + 'px';
        fo.style.height = bbox.height + 'px';
        fo.style.transform = 'none';

        const div = fo.querySelector('div');
        if (div) {
          div.style.cssText = 'width: 100% !important; height: 100% !important; display: flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; text-align: center !important;';
        }
      }
      return;
    }

    // ■ 2. ひし形ノード
    if (polygon) {
      return;
    }

    // ■ 3. 標準矩形ノード
    const rect = node.querySelector('rect');
    if (rect) {
      const bbox = rect.getBBox();
      const centerX = bbox.x + (bbox.width / 2);
      const newX = centerX - (TARGET_RECT_WIDTH / 2);

      const labelGroup = node.querySelector('g.label');
      const fo = node.querySelector('foreignObject');

      if (fo) {
        fo.setAttribute('x', newX);
        fo.setAttribute('width', TARGET_RECT_WIDTH);
        fo.style.setProperty('x', newX + 'px', 'important');
        fo.style.setProperty('width', TARGET_RECT_WIDTH + 'px', 'important');

        if (labelGroup) {
          labelGroup.removeAttribute('transform');
          labelGroup.style.transform = 'none';
        }

        const div = fo.querySelector('div');
        if (div) {
          div.style.cssText = `width: ${TARGET_RECT_WIDTH}px !important; min-width: ${TARGET_RECT_WIDTH}px !important; max-width: ${TARGET_RECT_WIDTH}px !important; display: flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 5px 6px !important; box-sizing: border-box !important; text-align: center !important; line-height: 1.15 !important; word-break: break-word !important;`;
        }

        const divHeight = div ? div.scrollHeight : bbox.height;
        const newHeight = Math.max(divHeight, 28);
        const centerY = bbox.y + (bbox.height / 2);
        const newY = centerY - (newHeight / 2);

        node.querySelectorAll('rect').forEach(r => {
          r.setAttribute('x', newX);
          r.setAttribute('width', TARGET_RECT_WIDTH);
          r.setAttribute('y', newY);
          r.setAttribute('height', newHeight);
          r.style.setProperty('x', newX + 'px', 'important');
          r.style.setProperty('width', TARGET_RECT_WIDTH + 'px', 'important');
          r.style.setProperty('y', newY + 'px', 'important');
          r.style.setProperty('height', newHeight + 'px', 'important');
        });

        fo.setAttribute('y', newY);
        fo.setAttribute('height', newHeight);
        fo.style.setProperty('y', newY + 'px', 'important');
        fo.style.setProperty('height', newHeight + 'px', 'important');
      }
    }
  });

  // 2. ひし形ノード扁平化 ＆ 幾何交点計算による完璧な矢印吸着
  document.querySelectorAll('.node').forEach(node => {
    const polygon = node.querySelector('polygon');
    if (!polygon) return;

    // ノードの絶対座標（translate）
    const transform = node.getAttribute('transform') || '';
    const tMatch = /translate\(\s*([-+]?[\d\.]+)[,\s]+([-+]?[\d\.]+)\s*\)/.exec(transform);
    let nodeX = 0, nodeY = 0;
    if (tMatch) {
      nodeX = parseFloat(tMatch[1]);
      nodeY = parseFloat(tMatch[2]);
    }

    const pointsAttr = polygon.getAttribute('points');
    if (!pointsAttr) return;

    const pts = pointsAttr.trim().split(/\s+/).map(p => {
      const [x, y] = p.split(',').map(Number);
      return { x, y };
    });

    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    pts.forEach(p => {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    });

    const centerY = (minY + maxY) / 2;
    const centerX = (minX + maxX) / 2;
    const origHalfWidth = (maxX - minX) / 2;
    const origHalfHeight = (maxY - minY) / 2;
    const newHalfHeight = origHalfHeight * RHOMBUS_FLAT_FACTOR;

    // ひし形頂点の扁平化
    const newPts = pts.map(p => {
      const newY = centerY + (p.y - centerY) * RHOMBUS_FLAT_FACTOR;
      return `${p.x},${newY}`;
    });
    polygon.setAttribute('points', newPts.join(' '));

    // テキスト位置調整
    if (RHOMBUS_TEXT_OFFSET_X !== 0) {
      const labelGroup = node.querySelector('g.label');
      if (labelGroup) {
        const currentTransform = labelGroup.getAttribute('transform') || '';
        labelGroup.setAttribute('transform', currentTransform + ` translate(${RHOMBUS_TEXT_OFFSET_X}, 0)`);
      }
    }

    // 扁平化後のひし形4辺の絶対座標
    const absCenter = { x: nodeX + centerX, y: nodeY + centerY };
    const topV    = { x: absCenter.x, y: absCenter.y - newHalfHeight };
    const rightV  = { x: absCenter.x + origHalfWidth, y: absCenter.y };
    const bottomV = { x: absCenter.x, y: absCenter.y + newHalfHeight };
    const leftV   = { x: absCenter.x - origHalfWidth, y: absCenter.y };

    const rhombusSides = [
      [topV, rightV],
      [rightV, bottomV],
      [bottomV, leftV],
      [leftV, topV]
    ];

    // 全てのパス（矢印）に対して幾何交点計算を実行
    document.querySelectorAll('.edgePath path, .edgePaths path, svg path').forEach(path => {
      let d = path.getAttribute('d');
      if (!d) return;

      const tokens = d.match(/([a-zA-Z])|([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g);
      if (!tokens) return;

      let cmds = [];
      let currentCmd = null;
      let currentArgs = [];

      for (let token of tokens) {
        if (/^[a-zA-Z]$/.test(token)) {
          if (currentCmd) {
            cmds.push({ cmd: currentCmd, args: currentArgs });
          }
          currentCmd = token;
          currentArgs = [];
        } else {
          currentArgs.push(parseFloat(token));
        }
      }
      if (currentCmd) {
        cmds.push({ cmd: currentCmd, args: currentArgs });
      }

      if (cmds.length === 0) return;

      // パス内の全ての座標点を抽出
      let ptList = [];
      cmds.forEach(c => {
        for (let i = 0; i < c.args.length; i += 2) {
          if (i + 1 < c.args.length) {
            ptList.push({ x: c.args[i], y: c.args[i+1] });
          }
        }
      });

      if (ptList.length < 2) return;

      let isUpdated = false;

      // --- 【入る矢印】の判定と交点補正 ---
      const endPt = ptList[ptList.length - 1];
      const prevPt = ptList[ptList.length - 2];
      const distToEnd = Math.hypot(endPt.x - absCenter.x, endPt.y - absCenter.y);

      if (distToEnd < Math.max(origHalfWidth, origHalfHeight) * 1.8) {
        let bestInt = null;
        let minDist = Infinity;

        for (let side of rhombusSides) {
          const inter = lineIntersection(prevPt, endPt, side[0], side[1]);
          if (inter) {
            const dist = Math.hypot(inter.x - prevPt.x, inter.y - prevPt.y);
            if (dist < minDist) {
              minDist = dist;
              bestInt = inter;
            }
          }
        }

        if (bestInt) {
          const lastCmd = cmds[cmds.length - 1];
          const lastXIdx = lastCmd.args.length - 2;
          const lastYIdx = lastCmd.args.length - 1;

          lastCmd.args[lastXIdx] = bestInt.x;
          lastCmd.args[lastYIdx] = bestInt.y;

          // ベジェ曲線の場合、制御点も直線方向に並ぶよう微補正し折り返りを防止
          if (lastCmd.cmd === 'C' && lastCmd.args.length >= 6) {
            const dx = bestInt.x - prevPt.x;
            const dy = bestInt.y - prevPt.y;
            lastCmd.args[2] = prevPt.x + dx * 0.7;
            lastCmd.args[3] = prevPt.y + dy * 0.7;
          }
          isUpdated = true;
        }
      }

      // --- 【出る矢印】の判定と交点補正 ---
      const startPt = ptList[0];
      const nextPt = ptList[1];
      const distToStart = Math.hypot(startPt.x - absCenter.x, startPt.y - absCenter.y);

      if (distToStart < Math.max(origHalfWidth, origHalfHeight) * 1.8) {
        let bestInt = null;
        let minDist = Infinity;

        for (let side of rhombusSides) {
          const inter = lineIntersection(nextPt, startPt, side[0], side[1]);
          if (inter) {
            const dist = Math.hypot(inter.x - nextPt.x, inter.y - nextPt.y);
            if (dist < minDist) {
              minDist = dist;
              bestInt = inter;
            }
          }
        }

        if (bestInt) {
          cmds[0].args[0] = bestInt.x;
          cmds[0].args[1] = bestInt.y;

          if (cmds.length > 1 && cmds[1].cmd === 'C' && cmds[1].args.length >= 6) {
            const dx = nextPt.x - bestInt.x;
            const dy = nextPt.y - bestInt.y;
            cmds[1].args[0] = bestInt.x + dx * 0.3;
            cmds[1].args[1] = bestInt.y + dy * 0.3;
          }
          isUpdated = true;
        }
      }

      if (isUpdated) {
        let newD = '';
        for (let c of cmds) {
          newD += c.cmd + ' ' + c.args.join(' ') + ' ';
        }
        path.setAttribute('d', newD.trim());
      }
    });
  });

  // 3. SVG全体の描画領域（viewBox）調整
  const svg = document.querySelector('.mermaid svg');
  if (svg) {
    const bbox = svg.getBBox();
    const padding = 30;

    const x = bbox.x - padding;
    const y = bbox.y - padding;
    const w = bbox.width + (padding * 2);
    const h = bbox.height + (padding * 2);

    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.style.maxWidth = 'none';
  }

  // 4. ツールチップ制御
  const tooltip = document.getElementById("tooltip");
  document.querySelectorAll('svg title').forEach(el => el.remove());

  document.querySelectorAll('.node').forEach(node => {
    //const textContent = node.textContent.trim();
    var textContent = node.textContent.trim();
    //textContent = textContent.replace(/[\r\n\s]+/g, '');
    textContent = textContent.replace(/\\n/g, '').replace(/[\r\n\s\\]+/g, '');
    let matchedText = "";



    if (typeof tooltipMap !== 'undefined') {
      for (let key in tooltipMap) {
        //**************** 改行の為追加 どーせGemini嘘付いてるだろうけど ******************* */
        //var cleanKey = key.replace(/[\r\n\s\\]+/g, '').replace(/n/g, '');
        //var cleanKey = key.replace(/\\n|\n|[\r\s]+/g, '');
        var cleanKey = key.replace(/\\n/g, '').replace(/[\r\n\s\\]+/g, '');
        
        
        //if (textContent.includes(key)) {
        //if (textContent.includes(cleanKey)) {
        if (textContent.includes(cleanKey) || cleanKey.includes(textContent)) {
          matchedText = tooltipMap[key];
          break;
        }
      }
    }

    if (matchedText) {
      node.addEventListener('mouseenter', () => {
        //tooltip.innerHTML = matchedText;
        tooltip.innerHTML = matchedText.replace(/\\n|\n/g, '<br>');
        tooltip.style.display = 'block';
      });
      node.addEventListener('mousemove', (e) => {
        tooltip.style.left = (e.pageX + 15) + 'px';
        tooltip.style.top = (e.pageY + 15) + 'px';
      });
      node.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    }
  });
});
