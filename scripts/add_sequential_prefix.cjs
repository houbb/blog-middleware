const fs = require('fs');
const path = require('path');

// 获取posts目录路径
const postsDir = path.join(__dirname, '../src/posts');

// 读取所有子目录
const categories = fs.readdirSync(postsDir).filter(file => 
  fs.statSync(path.join(postsDir, file)).isDirectory()
);

console.log(`找到 ${categories.length} 个分类目录`);

// 为每个目录下的文件添加序号前缀
categories.forEach(category => {
  const categoryDir = path.join(postsDir, category);
  const files = fs.readdirSync(categoryDir).filter(file => 
    fs.statSync(path.join(categoryDir, file)).isFile() && file.endsWith('.md')
  );
  
  console.log(`\n处理目录: ${category}，共 ${files.length} 个文件`);
  
  // 按照文件名排序
  files.sort();
  
  // 为每个文件添加序号前缀
  files.forEach((file, index) => {
    const oldPath = path.join(categoryDir, file);
    // 生成三位数序号
    const sequenceNumber = String(index + 1).padStart(3, '0');
    // 新文件名
    const newFileName = `${sequenceNumber}-${file}`;
    const newPath = path.join(categoryDir, newFileName);
    
    // 重命名文件
    fs.renameSync(oldPath, newPath);
    console.log(`  重命名: ${file} -> ${newFileName}`);
  });
});

console.log('\n所有文件处理完成！');