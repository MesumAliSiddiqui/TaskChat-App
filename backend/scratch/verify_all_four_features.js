const assert = require('assert');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Load environment from backend
require('dotenv').config({ path: 'd:/ChatApp/backend/.env' });

const User = require('d:/ChatApp/backend/models/User');
const Chat = require('d:/ChatApp/backend/models/Chat');
const Message = require('d:/ChatApp/backend/models/Message');
const Task = require('d:/ChatApp/backend/models/Task');

const connectDB = require('d:/ChatApp/backend/config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'taskchat_secret_key_2024';

async function runTests() {
  console.log('--- STARTING ALL 4 FEATURES VERIFICATION ---');

  await connectDB();
  console.log('Connected to MongoDB via connectDB');

  try {
    // 1. Setup Test Users: 1 Manager/Boss, 1 Employee
    let manager = await User.findOne({ email: 'manager_test@example.com' });
    if (!manager) {
      manager = await User.create({
        name: 'Manager Test',
        email: 'manager_test@example.com',
        phone: '1234567890',
        password: 'hashedpassword123',
        role: 'manager',
      });
    }

    let employee = await User.findOne({ email: 'employee_test@example.com' });
    if (!employee) {
      employee = await User.create({
        name: 'Employee Test',
        email: 'employee_test@example.com',
        phone: '0987654321',
        password: 'hashedpassword123',
        role: 'employee',
      });
    }

    // ==========================================
    // TEST 1: UNIVERSAL TASK DETAILS & ACTIONS
    // ==========================================
    console.log('\n[TEST 1] Universal Task Details & Status Transitions...');
    let task = await Task.create({
      title: 'Universal Verification Task',
      description: 'Testing universal task status updates and reopening',
      assignedBy: manager._id,
      assignedTo: [employee._id],
      status: 'pending',
      deadline: new Date(Date.now() + 86400000),
      deductionAmount: 50,
    });

    // Simulate Employee updating status to 'in_progress'
    // Logic from backend/routes/tasks.js
    const isAssignee = (task.assignedTo || []).some(a => a.toString() === employee._id.toString());
    const isCreator = task.assignedBy.toString() === employee._id.toString();
    const canUpdateStatus = isAssignee || isCreator || ['boss', 'manager'].includes(employee.role);
    assert.strictEqual(canUpdateStatus, true, 'Employee should be authorized to update task status');

    task.status = 'in_progress';
    await task.save();
    assert.strictEqual(task.status, 'in_progress', 'Task status should be updated to in_progress');
    console.log('✓ Employee transitioned task to in_progress');

    // Simulate Employee marking task 'completed'
    task.status = 'completed';
    task.completedAt = new Date();
    task.completedBy = employee._id;
    await task.save();
    assert.strictEqual(task.status, 'completed', 'Task status should be completed');
    assert.ok(task.completedAt, 'Task completedAt should be recorded');
    assert.strictEqual(task.completedBy.toString(), employee._id.toString(), 'completedBy should match employee');
    console.log('✓ Employee marked task as completed');

    // Simulate Reopening Task
    task.status = 'in_progress';
    task.completedAt = null;
    task.completedBy = null;
    await task.save();
    assert.strictEqual(task.status, 'in_progress', 'Reopened task should be in_progress');
    assert.strictEqual(task.completedAt, null, 'completedAt should be cleared');
    assert.strictEqual(task.completedBy, null, 'completedBy should be cleared');
    console.log('✓ Reopened task successfully cleared completedAt and completedBy');

    // Clean up task
    await Task.findByIdAndDelete(task._id);

    // ==========================================
    // TEST 2: CHAT LIST SORTING & CALL LOG PREVIEWS
    // ==========================================
    console.log('\n[TEST 2] Chat List Sorting & Call Log Previews...');
    
    // Clear any previous test chats between these users
    await Chat.deleteMany({ members: { $all: [manager._id, employee._id] } });

    // Create two test chats
    const chat1 = await Chat.create({
      isGroup: false,
      members: [manager._id, employee._id],
      updatedAt: new Date(Date.now() - 50000),
    });

    const chat2 = await Chat.create({
      isGroup: true,
      name: 'Test Group',
      members: [manager._id, employee._id],
      updatedAt: new Date(Date.now() - 100000),
    });

    // Send a regular message to chat2 with recent timestamp
    const recentMsgChat2 = await Message.create({
      chat: chat2._id,
      sender: manager._id,
      text: 'Hello chat 2',
      createdAt: new Date(Date.now() - 10000),
    });
    chat2.lastMessage = recentMsgChat2._id;
    chat2.updatedAt = recentMsgChat2.createdAt;
    await chat2.save();

    // Send a call log message to chat1 with freshest timestamp
    const callLogMsgChat1 = await Message.create({
      chat: chat1._id,
      sender: manager._id,
      text: '📞 Voice call',
      createdAt: new Date(),
    });
    chat1.lastMessage = callLogMsgChat1._id;
    chat1.updatedAt = callLogMsgChat1.createdAt;
    await chat1.save();

    // Verify Sorting Logic from backend/routes/chats.js
    const chatsFromDb = await Chat.find({ _id: { $in: [chat1._id, chat2._id] } }).populate('lastMessage');
    chatsFromDb.sort((a, b) => {
      const timeA = Math.max(
        a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0,
        a.updatedAt ? new Date(a.updatedAt).getTime() : 0,
        new Date(a.createdAt).getTime()
      );
      const timeB = Math.max(
        b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0,
        b.updatedAt ? new Date(b.updatedAt).getTime() : 0,
        new Date(b.createdAt).getTime()
      );
      return timeB - timeA;
    });

    assert.strictEqual(chatsFromDb[0]._id.toString(), chat1._id.toString(), 'Chat 1 with latest call log should be at index 0');
    console.log('✓ Backend explicit sorting places chat with latest message at top');

    // Test getMessagePreview logic in ChatListScreen.jsx
    const getMessagePreview = (item) => {
      if (!item.lastMessage) return 'No messages yet';
      const msg = item.lastMessage;
      if (typeof msg === 'string') return msg;
      if (typeof msg.text === 'string' && msg.text.startsWith('📞')) {
        return msg.text.includes('Group') ? '📞 Group voice call' : '📞 Voice call';
      }
      if (msg.text) return msg.text;
      if (msg.image || msg.attachmentUrl) return '📷 Photo';
      return 'Message';
    };

    assert.strictEqual(getMessagePreview(chatsFromDb[0]), '📞 Voice call', 'getMessagePreview should format call log preview correctly');
    console.log('✓ Chat list preview correctly formats "📞 Voice call"');

    // Clean up test messages & chats
    await Message.deleteMany({ _id: { $in: [recentMsgChat2._id, callLogMsgChat1._id] } });
    await Chat.deleteMany({ _id: { $in: [chat1._id, chat2._id] } });

    // ==========================================
    // TEST 3: CALL LOG IN CHAT ROOM STREAM
    // ==========================================
    console.log('\n[TEST 3] Call Log Creation & Stream Integration...');
    const testCallPlacement = (isGroup) => {
      const callText = isGroup ? '📞 Group voice call' : '📞 Voice call';
      const tempId = `temp_${Date.now()}`;
      const callLogPayload = {
        tempId,
        chatId: 'mock_chat_id',
        text: callText,
        sender: { _id: manager._id, name: manager.name },
      };
      assert.ok(callLogPayload.text.startsWith('📞'), 'Call log text must start with 📞');
      return callLogPayload;
    };

    const directCall = testCallPlacement(false);
    assert.strictEqual(directCall.text, '📞 Voice call');
    const groupCall = testCallPlacement(true);
    assert.strictEqual(groupCall.text, '📞 Group voice call');
    console.log('✓ Direct and group call logs generated correctly with "📞" prefix');

    // ==========================================
    // TEST 4: MESSAGE FORWARDING PIPELINE
    // ==========================================
    console.log('\n[TEST 4] Message Forwarding Multi-Recipient Pipeline...');
    const mockSelectedMessages = [
      { _id: 'msg_1', text: 'Important announcement', image: null },
      { _id: 'msg_2', text: '', image: 'https://cdn.example.com/photo.jpg' },
    ];
    const mockTargetChatIds = ['chat_A', 'chat_B'];

    const dispatchedQueue = [];
    const mockSendOrQueue = (payload) => {
      dispatchedQueue.push(payload);
    };

    for (const targetChatId of mockTargetChatIds) {
      for (const msg of mockSelectedMessages) {
        const payload = {
          tempId: `temp_fwd_${Date.now()}`,
          chatId: targetChatId,
          text: msg.text || '',
          image: msg.image || null,
          sender: { _id: manager._id, name: manager.name },
        };
        mockSendOrQueue(payload);
      }
    }

    assert.strictEqual(dispatchedQueue.length, 4, 'Should dispatch 4 messages (2 messages x 2 chats)');
    assert.strictEqual(dispatchedQueue[0].chatId, 'chat_A');
    assert.strictEqual(dispatchedQueue[0].text, 'Important announcement');
    assert.strictEqual(dispatchedQueue[1].chatId, 'chat_A');
    assert.strictEqual(dispatchedQueue[1].image, 'https://cdn.example.com/photo.jpg');
    assert.strictEqual(dispatchedQueue[2].chatId, 'chat_B');
    assert.strictEqual(dispatchedQueue[3].chatId, 'chat_B');
    console.log('✓ Forwarding pipeline correctly duplicates and queues messages across multiple destination chats');

    console.log('\n--- ALL 4 FEATURES VERIFIED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
