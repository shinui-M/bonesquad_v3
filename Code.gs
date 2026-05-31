// =============================================================
// 뼈갈단 V3 — Google Apps Script V32
// saveTask: 중복 행 전부 삭제 후 새 행 추가 방식으로 변경
// =============================================================

var COLS = {
  Tasks:               ['date','name','task'],
  Feeds:               ['id','authorName','content','timestamp'],
  Comments:            ['feedId','authorName','content','timestamp'],
  Members:             ['name','bio','avatar','createdAt','bannerColor'],
  GroupMembers:        ['groupName','name','avatar'],
  GroupPosts:          ['id','groupName','name','content','timestamp'],
  DietLogs:            ['date','name','groupName','content'],
  Groups:              ['id','name','desc','emoji','creator'],
  DeletedDefaultGroups:['id']
};

function cellStr(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-M-d');
  }
  return (val !== undefined && val !== null) ? String(val) : '';
}

function readSheet(ss, name) {
  var cols = COLS[name];
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var lr = sheet.getLastRow();
  if (lr === 0) return [];
  var vals = sheet.getRange(1, 1, lr, cols.length).getValues();
  var start = (cellStr(vals[0][0]).trim() === cols[0]) ? 1 : 0;
  var out = [];
  for (var i = start; i < vals.length; i++) {
    var row = vals[i];
    var empty = true;
    for (var k = 0; k < cols.length; k++) { if (row[k] !== '' && row[k] !== null) { empty = false; break; } }
    if (empty) continue;
    var obj = {};
    for (var j = 0; j < cols.length; j++) { obj[cols[j]] = cellStr(row[j]); }
    out.push(obj);
  }
  return out;
}

function findRow(sheet, name, criteria) {
  var cols = COLS[name];
  var lr = sheet.getLastRow();
  if (lr === 0) return -1;
  var vals = sheet.getRange(1, 1, lr, cols.length).getValues();
  var start = (cellStr(vals[0][0]).trim() === cols[0]) ? 1 : 0;
  var keys = Object.keys(criteria);
  for (var i = start; i < vals.length; i++) {
    var match = true;
    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      var ci = cols.indexOf(k);
      if (ci < 0 || cellStr(vals[i][ci]).trim() !== String(criteria[k]).trim()) { match = false; break; }
    }
    if (match) return i + 1;
  }
  return -1;
}

function upsert(ss, name, criteria, fullRow) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return;
  var rowNum = findRow(sheet, name, criteria);
  if (rowNum > 0) {
    for (var j = 0; j < fullRow.length; j++) sheet.getRange(rowNum, j + 1).setValue(fullRow[j]);
  } else {
    sheet.appendRow(fullRow);
  }
}

function updateCol(ss, name, criteria, colName, value) {
  var cols = COLS[name];
  var sheet = ss.getSheetByName(name);
  if (!sheet) return;
  var rowNum = findRow(sheet, name, criteria);
  if (rowNum > 0) {
    var ci = cols.indexOf(colName);
    if (ci >= 0) sheet.getRange(rowNum, ci + 1).setValue(value);
  }
}

function delRow(ss, name, criteria) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return;
  var rowNum = findRow(sheet, name, criteria);
  if (rowNum > 0) sheet.deleteRow(rowNum);
}

function deduplicateTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var sheet = ss.getSheetByName('Tasks');
  if (!sheet) { Logger.log('Tasks 시트 없음'); return; }

  var lr = sheet.getLastRow();
  if (lr === 0) { Logger.log('데이터 없음'); return; }

  var vals = sheet.getRange(1, 1, lr, 3).getValues();

  var keyOrder = [];
  var latestMap = {};
  for (var i = 0; i < vals.length; i++) {
    var dVal = vals[i][0];
    var dStr = (dVal instanceof Date)
      ? Utilities.formatDate(dVal, tz, 'yyyy-M-d')
      : String(dVal).trim();
    var nStr = String(vals[i][1]).trim();
    if (!dStr && !nStr) continue;
    var key = dStr + '|' + nStr;
    if (!latestMap[key]) keyOrder.push(key);
    latestMap[key] = [dStr, nStr, String(vals[i][2])];
  }

  var before = vals.filter(function(r){ return String(r[0]).trim() || String(r[1]).trim(); }).length;
  var after = keyOrder.length;
  if (before === after) { Logger.log('중복 없음'); return; }

  sheet.clearContents();
  for (var j = 0; j < keyOrder.length; j++) {
    sheet.appendRow(latestMap[keyOrder[j]]);
  }
  Logger.log('정리 완료: ' + before + '행 → ' + after + '행 (' + (before - after) + '개 제거)');
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    function safe(name) {
      try { return readSheet(ss, name); } catch(err) { return []; }
    }

    var allCmts = safe('Comments');
    var comments = [], taskLikes = [], taskComments = [];

    for (var ci = 0; ci < allCmts.length; ci++) {
      var r = allCmts[ci];
      var fid = r.feedId || '';

      if (fid.indexOf('like:') === 0) {
        var rest2 = fid.slice(5);
        var p1 = rest2.indexOf(':');
        if (p1 < 0) continue;
        var dateStr = rest2.slice(0, p1);
        var rest3 = rest2.slice(p1 + 1);
        var p2 = rest3.indexOf(':');
        if (p2 < 0) continue;
        taskLikes.push({ date: dateStr, targetName: rest3.slice(0, p2), likerName: rest3.slice(p2 + 1) });

      } else if (fid.indexOf('cmt:') === 0) {
        try {
          var meta = JSON.parse(r.content);
          taskComments.push({ id: fid.slice(4), date: meta.date, targetName: meta.target, authorName: r.authorName, content: meta.text });
        } catch(e2) {}

      } else if (fid.indexOf('rate:') !== 0) {
        comments.push(r);
      }
    }

    var result = {
      tasks:               safe('Tasks'),
      feeds:               safe('Feeds'),
      comments:            comments,
      taskLikes:           taskLikes,
      taskComments:        taskComments,
      members:             safe('Members'),
      groupMembers:        safe('GroupMembers'),
      groupPosts:          safe('GroupPosts'),
      dietLogs:            safe('DietLogs'),
      groups:              safe('Groups'),
      deletedDefaultGroups: safe('DeletedDefaultGroups')
    };

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    var empty = { tasks:[], feeds:[], comments:[], taskLikes:[], taskComments:[], members:[], groupMembers:[], groupPosts:[], dietLogs:[], groups:[], deletedDefaultGroups:[], _error: String(err) };
    return ContentService.createTextOutput(JSON.stringify(empty)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var p;
  try { p = JSON.parse(e.postData.contents); } catch(err) { return ok(); }

  var now = new Date().toISOString();
  var tz = ss.getSpreadsheetTimeZone();

  try {
    if (p.action === 'saveTask') {
      var tSheet = ss.getSheetByName('Tasks');
      var tLr = tSheet.getLastRow();
      var pDate = String(p.date).trim();
      var pName = String(p.name).trim();
      if (tLr > 0) {
        var tVals = tSheet.getRange(1, 1, tLr, 3).getValues();
        // 역순으로 매칭 행 전부 삭제 (삭제 시 인덱스 밀림 방지)
        for (var ti = tVals.length - 1; ti >= 0; ti--) {
          var dVal = tVals[ti][0];
          var dStr = (dVal instanceof Date)
            ? Utilities.formatDate(dVal, tz, 'yyyy-M-d')
            : String(dVal).trim();
          if (dStr === pDate && String(tVals[ti][1]).trim() === pName) {
            tSheet.deleteRow(ti + 1);
          }
        }
      }
      tSheet.appendRow([p.date, p.name, p.task]);

    } else if (p.action === 'saveFeed') {
      ss.getSheetByName('Feeds').appendRow([p.id, p.name, p.content, p.timestamp || now]);

    } else if (p.action === 'deleteFeed') {
      delRow(ss, 'Feeds', {id: p.id});

    } else if (p.action === 'editFeed') {
      updateCol(ss, 'Feeds', {id: p.id}, 'content', p.content);

    } else if (p.action === 'saveComment') {
      ss.getSheetByName('Comments').appendRow([p.feedId, p.name, p.content, p.timestamp || now]);

    } else if (p.action === 'saveMember') {
      upsert(ss, 'Members', {name: p.name}, [p.name, p.bio||'', p.avatar||'', p.createdAt||now, p.bannerColor||'']);

    } else if (p.action === 'joinGroup') {
      var gmSheet = ss.getSheetByName('GroupMembers');
      if (gmSheet && findRow(gmSheet, 'GroupMembers', {groupName: p.groupName, name: p.name}) < 0) {
        gmSheet.appendRow([p.groupName, p.name, p.avatar||'']);
      }

    } else if (p.action === 'leaveGroup') {
      delRow(ss, 'GroupMembers', {groupName: p.groupName, name: p.name});

    } else if (p.action === 'saveGroupPost') {
      ss.getSheetByName('GroupPosts').appendRow([p.id, p.groupName, p.name, p.content, p.timestamp || now]);

    } else if (p.action === 'editGroupPost') {
      updateCol(ss, 'GroupPosts', {id: p.id}, 'content', p.content);

    } else if (p.action === 'deleteGroupPost') {
      delRow(ss, 'GroupPosts', {id: p.id});

    } else if (p.action === 'saveDietLog') {
      upsert(ss, 'DietLogs', {date: p.date, name: p.name, groupName: p.groupName},
        [p.date, p.name, p.groupName||'', p.content||'']);

    } else if (p.action === 'saveTaskLike') {
      var lFeedId = 'like:' + p.date + ':' + p.targetName + ':' + p.likerName;
      var lSheet = ss.getSheetByName('Comments');
      if (lSheet && findRow(lSheet, 'Comments', {feedId: lFeedId}) < 0) {
        lSheet.appendRow([lFeedId, p.likerName, '1', now]);
      }

    } else if (p.action === 'deleteTaskLike') {
      delRow(ss, 'Comments', {feedId: 'like:' + p.date + ':' + p.targetName + ':' + p.likerName});

    } else if (p.action === 'saveTaskComment') {
      var tcMeta = JSON.stringify({date: p.date, target: p.targetName, text: p.content});
      ss.getSheetByName('Comments').appendRow(['cmt:' + p.id, p.authorName, tcMeta, now]);

    } else if (p.action === 'editTaskComment') {
      var ecSheet = ss.getSheetByName('Comments');
      var ecRow = findRow(ecSheet, 'Comments', {feedId: 'cmt:' + p.id});
      if (ecRow > 0) {
        var ecContentCol = COLS['Comments'].indexOf('content') + 1;
        var existing = ecSheet.getRange(ecRow, ecContentCol).getValue();
        try {
          var ecMeta = JSON.parse(existing);
          ecMeta.text = p.content;
          ecSheet.getRange(ecRow, ecContentCol).setValue(JSON.stringify(ecMeta));
        } catch(e3) {
          ecSheet.getRange(ecRow, ecContentCol).setValue(p.content);
        }
      }

    } else if (p.action === 'deleteTaskComment') {
      delRow(ss, 'Comments', {feedId: 'cmt:' + p.id});
    }
  } catch(err) {}

  return ok();
}

function ok() {
  return ContentService.createTextOutput(JSON.stringify({result:'ok'})).setMimeType(ContentService.MimeType.JSON);
}
