const { getDB, initDB } = require('./database');

initDB();
const db = getDB();

const action = process.argv[2];
const target = process.argv[3];

if (!action || action === 'list') {
  const users = db.prepare('SELECT id, username, email, verified, created_at, last_login FROM users').all();
  console.log('\n📋 Registered Users in Database:');
  if (users.length === 0) {
    console.log('  (No registered users found)');
  } else {
    console.table(users);
  }
  console.log('\nCommands you can run:');
  console.log('  node manage-users.js list              -> View all users');
  console.log('  node manage-users.js delete <email>    -> Delete a specific user');
  console.log('  node manage-users.js reset-all         -> Delete ALL users & start fresh\n');
} else if (action === 'delete') {
  if (!target) {
    console.error('❌ Please specify an email to delete: node manage-users.js delete <email>');
    process.exit(1);
  }
  const user = db.prepare('SELECT id, username, email FROM users WHERE email = ?').get(target);
  if (!user) {
    console.error(`❌ User with email "${target}" not found.`);
    process.exit(1);
  }
  db.prepare('DELETE FROM tasks WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM attendance WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM otps WHERE email = ?').run(target);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  console.log(`✅ Successfully deleted user: ${user.username} (${user.email}) and all related records!`);
} else if (action === 'reset-all') {
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM attendance').run();
  db.prepare('DELETE FROM otps').run();
  db.prepare('DELETE FROM users').run();
  console.log('🧹 Successfully cleared all users, tasks, OTPs, and attendance records from database!');
} else {
  console.log('Unknown command. Use: node manage-users.js [list | delete <email> | reset-all]');
}
