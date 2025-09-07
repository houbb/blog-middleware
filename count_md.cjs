#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 获取 posts 目录路径
const postsDir = path.join(__dirname, 'src', 'posts');

// 检查目录是否存在
if (!fs.existsSync(postsDir)) {
  console.error('Error: src/posts directory not found');
  process.exit(1);
}

// 读取目录内容
const categories = fs.readdirSync(postsDir).filter(item => 
  fs.statSync(path.join(postsDir, item)).isDirectory()
);

let totalFiles = 0;

console.log('文件统计结果:');
console.log('========================');

// 遍历每个专题目录并统计文件数量
categories.forEach(category => {
  const categoryPath = path.join(postsDir, category);
  const files = fs.readdirSync(categoryPath).filter(file => 
    fs.statSync(path.join(categoryPath, file)).isFile()
  );
  
  const fileCount = files.length;
  totalFiles += fileCount;
  
  console.log(`${category}: ${fileCount} 个文件`);
});

console.log('========================');
console.log(`总计: ${totalFiles} 个文件`);