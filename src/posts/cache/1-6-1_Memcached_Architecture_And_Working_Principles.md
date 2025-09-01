---
title: Memcached架构与工作原理：深入理解高性能缓存系统的核心机制
date: 2025-08-30
categories: [Cache]
tags: [cache]
published: true
---

Memcached作为一个高性能的分布式内存对象缓存系统，自2003年由Brad Fitzpatrick开发以来，一直以其简单性、高性能和可扩展性在互联网应用中得到广泛应用。理解Memcached的架构与工作原理对于正确使用和优化这一缓存系统至关重要。本节将深入探讨Memcached的系统架构、核心组件、工作流程以及性能优化机制。

## Memcached概述

Memcached是一个自由开源的高性能分布式内存对象缓存系统，主要用于动态Web应用以减轻数据库负载。它通过在内存中缓存数据和对象来减少读取数据库的次数，从而提高Web应用的速度。Memcached基于一个存储键值对的哈希表，其守护进程运行在服务器上，通过简单的协议处理客户端的请求。

### 核心特性

1. **简单性**：采用简单的键值存储模型，API简洁易用
2. **高性能**：基于libevent事件驱动，支持高并发访问
3. **分布式**：支持多台服务器协同工作
4. **内存管理**：高效的内存分配和回收机制
5. **协议简单**：使用简单的文本协议进行通信
6. **跨平台**：支持多种操作系统和编程语言

## Memcached系统架构

### 1. 整体架构

Memcached采用客户端-服务器架构，其核心组件包括：

```java
// Memcached架构示意图
/*
客户端应用
    ↓
Memcached客户端库
    ↓
网络通信
    ↓
Memcached服务器集群
    ↓
内存存储层
*/
```

### 2. 服务器端架构

```java
// Memcached服务器端架构
public class MemcachedServerArchitecture {
    
    /*
    Memcached服务器端核心组件：
    
    1. 网络层：处理客户端连接和请求
    2. 协议解析层：解析文本协议命令
    3. 内存管理层：管理内存分配和回收
    4. 存储引擎：存储键值对数据
    5. 淘汰策略：LRU算法淘汰过期数据
    6. 统计监控：收集运行时统计信息
    */
    
    // 核心组件接口
    public interface MemcachedComponent {
        void initialize();
        void shutdown();
    }
    
    // 网络处理组件
    public static class NetworkHandler implements MemcachedComponent {
        private EventBase eventBase;
        private int port;
        private ServerSocket serverSocket;
        
        @Override
        public void initialize() {
            try {
                // 初始化libevent事件循环
                eventBase = new EventBase();
                serverSocket = new ServerSocket(port);
                
                // 注册监听事件
                eventBase.registerListener(serverSocket, this::handleNewConnection);
            } catch (IOException e) {
                throw new RuntimeException("Failed to initialize network handler", e);
            }
        }
        
        private void handleNewConnection(Socket clientSocket) {
            // 处理新连接
            ConnectionHandler handler = new ConnectionHandler(clientSocket);
            eventBase.registerListener(clientSocket, handler::handleData);
        }
        
        @Override
        public void shutdown() {
            try {
                if (serverSocket != null) {
                    serverSocket.close();
                }
                if (eventBase != null) {
                    eventBase.shutdown();
                }
            } catch (IOException e) {
                log.warn("Error shutting down network handler", e);
            }
        }
    }
    
    // 连接处理组件
    public static class ConnectionHandler {
        private Socket socket;
        private ByteBuffer inputBuffer;
        private ByteBuffer outputBuffer;
        
        public ConnectionHandler(Socket socket) {
            this.socket = socket;
            this.inputBuffer = ByteBuffer.allocate(8192);
            this.outputBuffer = ByteBuffer.allocate(8192);
        }
        
        public void handleData() {
            try {
                // 读取客户端数据
                int bytesRead = socket.getInputStream().read(inputBuffer.array());
                if (bytesRead > 0) {
                    inputBuffer.position(bytesRead);
                    inputBuffer.flip();
                    
                    // 解析协议命令
                    Command command = parseCommand(inputBuffer);
                    if (command != null) {
                        // 处理命令
                        processCommand(command);
                    }
                }
            } catch (IOException e) {
                log.warn("Error handling client data", e);
                closeConnection();
            }
        }
        
        private Command parseCommand(ByteBuffer buffer) {
            // 解析Memcached文本协议命令
            // SET key flags exptime bytes [noreply]\r\n
            // VALUE key flags bytes\r\n
            // END\r\n
            return null; // 简化实现
        }
        
        private void processCommand(Command command) {
            // 根据命令类型处理
            switch (command.getType()) {
                case SET:
                    handleSetCommand(command);
                    break;
                case GET:
                    handleGetCommand(command);
                    break;
                case DELETE:
                    handleDeleteCommand(command);
                    break;
                // 其他命令...
            }
        }
        
        private void handleSetCommand(Command command) {
            // 处理SET命令
            StorageEngine.getInstance().set(command.getKey(), 
                                          command.getValue(), 
                                          command.getExpiryTime());
            
            // 发送响应
            sendResponse("STORED\r\n");
        }
        
        private void handleGetCommand(Command command) {
            // 处理GET命令
            Object value = StorageEngine.getInstance().get(command.getKey());
            if (value != null) {
                // 发送VALUE响应
                sendValueResponse(command.getKey(), value);
            } else {
                // 发送END响应
                sendResponse("END\r\n");
            }
        }
        
        private void handleDeleteCommand(Command command) {
            // 处理DELETE命令
            boolean deleted = StorageEngine.getInstance().delete(command.getKey());
            if (deleted) {
                sendResponse("DELETED\r\n");
            } else {
                sendResponse("NOT_FOUND\r\n");
            }
        }
        
        private void sendValueResponse(String key, Object value) {
            // 发送VALUE响应
            String response = String.format("VALUE %s 0 %d\r\n%s\r\nEND\r\n", 
                                          key, value.toString().length(), value);
            sendResponse(response);
        }
        
        private void sendResponse(String response) {
            try {
                socket.getOutputStream().write(response.getBytes());
            } catch (IOException e) {
                log.warn("Error sending response", e);
            }
        }
        
        private void closeConnection() {
            try {
                socket.close();
            } catch (IOException e) {
                log.warn("Error closing connection", e);
            }
        }
    }
    
    // 协议命令类
    public static class Command {
        private CommandType type;
        private String key;
        private Object value;
        private int flags;
        private int expiryTime;
        private boolean noReply;
        
        // 构造函数、getter、setter...
    }
    
    public enum CommandType {
        SET, GET, DELETE, ADD, REPLACE, APPEND, PREPEND, INCR, DECR, STATS, VERSION, QUIT
    }
}
```

### 3. 客户端架构

```java
// Memcached客户端架构
public class MemcachedClientArchitecture {
    
    /*
    Memcached客户端核心组件：
    
    1. 连接池：管理与服务器的连接
    2. 负载均衡：分发请求到不同服务器
    3. 协议编码：将操作编码为文本协议
    4. 结果解码：解析服务器响应
    5. 故障处理：处理服务器故障和重试
    6. 统计收集：收集客户端性能数据
    */
    
    // 客户端配置
    public static class ClientConfig {
        private List<InetSocketAddress> servers;
        private int connectionPoolSize;
        private int timeoutMillis;
        private int retryAttempts;
        private HashAlgorithm hashAlgorithm;
        
        // 构造函数、getter、setter...
    }
    
    // 哈希算法枚举
    public enum HashAlgorithm {
        NATIVE_HASH,   // 原生哈希
        CRC_HASH,      // CRC哈希
        FNV1_64_HASH,  // FNV1 64位哈希
        FNV1A_64_HASH, // FNV1A 64位哈希
        FNV1_32_HASH,  // FNV1 32位哈希
        FNV1A_32_HASH, // FNV1A 32位哈希
        KETAMA_HASH    // Ketama一致性哈希
    }
    
    // 连接池管理
    public static class ConnectionPool {
        private final List<InetSocketAddress> servers;
        private final Map<InetSocketAddress, Queue<MemcachedConnection>> connectionPools;
        private final int poolSize;
        
        public ConnectionPool(List<InetSocketAddress> servers, int poolSize) {
            this.servers = servers;
            this.poolSize = poolSize;
            this.connectionPools = new ConcurrentHashMap<>();
            initializeConnectionPools();
        }
        
        private void initializeConnectionPools() {
            for (InetSocketAddress server : servers) {
                Queue<MemcachedConnection> pool = new ConcurrentLinkedQueue<>();
                for (int i = 0; i < poolSize; i++) {
                    try {
                        MemcachedConnection connection = new MemcachedConnection(server);
                        pool.offer(connection);
                    } catch (IOException e) {
                        log.warn("Failed to create connection to " + server, e);
                    }
                }
                connectionPools.put(server, pool);
            }
        }
        
        public MemcachedConnection getConnection(String key) {
            // 根据键选择服务器
            InetSocketAddress server = selectServer(key);
            Queue<MemcachedConnection> pool = connectionPools.get(server);
            
            if (pool != null && !pool.isEmpty()) {
                return pool.poll();
            }
            
            // 如果连接池为空，创建新连接
            try {
                return new MemcachedConnection(server);
            } catch (IOException e) {
                throw new RuntimeException("Failed to create connection to " + server, e);
            }
        }
        
        public void returnConnection(MemcachedConnection connection) {
            InetSocketAddress server = connection.getServerAddress();
            Queue<MemcachedConnection> pool = connectionPools.get(server);
            if (pool != null) {
                pool.offer(connection);
            } else {
                // 关闭连接
                connection.close();
            }
        }
        
        private InetSocketAddress selectServer(String key) {
            // 使用一致性哈希选择服务器
            return KetamaNodeLocator.getInstance().getPrimary(key, servers);
        }
    }
    
    // Ketama一致性哈希实现
    public static class KetamaNodeLocator {
        private static final KetamaNodeLocator INSTANCE = new KetamaNodeLocator();
        
        public static KetamaNodeLocator getInstance() {
            return INSTANCE;
        }
        
        public InetSocketAddress getPrimary(String key, List<InetSocketAddress> nodes) {
            if (nodes.isEmpty()) {
                return null;
            }
            
            if (nodes.size() == 1) {
                return nodes.get(0);
            }
            
            // 计算键的哈希值
            long hash = hashKey(key);
            
            // 使用TreeMap存储节点哈希值，便于查找
            TreeMap<Long, InetSocketAddress> ketamaNodes = new TreeMap<>();
            for (InetSocketAddress node : nodes) {
                // 为每个节点生成多个虚拟节点
                for (int i = 0; i < 160; i++) {
                    long nodeHash = hashNode(node.toString() + "-" + i);
                    ketamaNodes.put(nodeHash, node);
                }
            }
            
            // 查找最近的节点
            if (!ketamaNodes.containsKey(hash)) {
                // 获取大于等于hash的第一个节点
                SortedMap<Long, InetSocketAddress> tailMap = ketamaNodes.tailMap(hash);
                hash = tailMap.isEmpty() ? ketamaNodes.firstKey() : tailMap.firstKey();
            }
            
            return ketamaNodes.get(hash);
        }
        
        private long hashKey(String key) {
            // 使用MD5哈希算法
            MessageDigest md5;
            try {
                md5 = MessageDigest.getInstance("MD5");
            } catch (NoSuchAlgorithmException e) {
                throw new RuntimeException("MD5 not supported", e);
            }
            
            md5.update(key.getBytes());
            byte[] digest = md5.digest();
            
            // 将16字节的MD5摘要转换为4个long值，然后求和
            long hash = 0;
            for (int i = 0; i < 4; i++) {
                hash += ((long) (digest[i * 4] & 0xFF) << 24)
                      | ((long) (digest[i * 4 + 1] & 0xFF) << 16)
                      | ((long) (digest[i * 4 + 2] & 0xFF) << 8)
                      | ((long) (digest[i * 4 + 3] & 0xFF));
            }
            return hash;
        }
        
        private long hashNode(String nodeInfo) {
            return hashKey(nodeInfo);
        }
    }
    
    // Memcached连接类
    public static class MemcachedConnection {
        private final InetSocketAddress serverAddress;
        private final Socket socket;
        private final BufferedReader reader;
        private final BufferedWriter writer;
        
        public MemcachedConnection(InetSocketAddress serverAddress) throws IOException {
            this.serverAddress = serverAddress;
            this.socket = new Socket(serverAddress.getAddress(), serverAddress.getPort());
            this.socket.setSoTimeout(5000); // 5秒超时
            this.reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            this.writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream()));
        }
        
        public void sendCommand(String command) throws IOException {
            writer.write(command);
            writer.flush();
        }
        
        public String readResponse() throws IOException {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line).append("\r\n");
                if (line.equals("END") || line.equals("STORED") || 
                    line.equals("DELETED") || line.equals("NOT_FOUND")) {
                    break;
                }
            }
            return response.toString();
        }
        
        public InetSocketAddress getServerAddress() {
            return serverAddress;
        }
        
        public void close() {
            try {
                if (socket != null && !socket.isClosed()) {
                    socket.close();
                }
            } catch (IOException e) {
                log.warn("Error closing connection", e);
            }
        }
    }
}
```

## Memcached工作流程

### 1. 数据存储流程

```java
// Memcached数据存储流程
public class MemcachedStorageWorkflow {
    
    /*
    SET命令处理流程：
    1. 客户端发送SET命令
    2. 客户端库编码命令并发送到服务器
    3. 服务器接收命令并解析
    4. 服务器检查内存是否足够
    5. 服务器分配内存存储数据
    6. 服务器返回响应给客户端
    */
    
    // SET命令处理示例
    public static class SetCommandHandler {
        
        public void handleSet(String key, Object value, int expiryTime, int flags) {
            // 1. 计算键的哈希值
            int hash = key.hashCode();
            
            // 2. 检查键是否已存在
            Item existingItem = StorageEngine.getInstance().getItem(key);
            if (existingItem != null) {
                // 3. 如果存在，更新数据
                existingItem.setValue(value);
                existingItem.setExpiryTime(System.currentTimeMillis() + expiryTime * 1000L);
                existingItem.setFlags(flags);
            } else {
                // 4. 如果不存在，创建新项
                Item newItem = new Item(key, value, flags, expiryTime);
                
                // 5. 检查内存是否足够
                if (!MemoryManager.getInstance().hasEnoughSpace(newItem.getSize())) {
                    // 6. 内存不足时执行LRU淘汰
                    evictItemsIfNeeded(newItem.getSize());
                }
                
                // 7. 分配内存并存储数据
                MemoryManager.getInstance().allocateItem(newItem);
                StorageEngine.getInstance().storeItem(newItem);
            }
            
            // 8. 返回成功响应
            sendResponse("STORED\r\n");
        }
        
        private void evictItemsIfNeeded(int requiredSpace) {
            // 执行LRU淘汰算法
            LRUManager.getInstance().evictItems(requiredSpace);
        }
        
        private void sendResponse(String response) {
            // 发送响应给客户端
        }
    }
    
    // 数据项类
    public static class Item {
        private String key;
        private Object value;
        private int flags;
        private long expiryTime;
        private int size;
        private long lastAccessTime;
        
        public Item(String key, Object value, int flags, int expiryTime) {
            this.key = key;
            this.value = value;
            this.flags = flags;
            this.expiryTime = System.currentTimeMillis() + expiryTime * 1000L;
            this.size = calculateSize();
            this.lastAccessTime = System.currentTimeMillis();
        }
        
        private int calculateSize() {
            // 计算项的大小
            int size = 0;
            size += key != null ? key.length() : 0;
            size += value != null ? value.toString().length() : 0;
            size += 32; // 对象头和其他元数据
            return size;
        }
        
        // getter和setter方法...
    }
}
```

### 2. 数据获取流程

```java
// Memcached数据获取流程
public class MemcachedRetrievalWorkflow {
    
    /*
    GET命令处理流程：
    1. 客户端发送GET命令
    2. 客户端库编码命令并发送到服务器
    3. 服务器接收命令并解析
    4. 服务器查找键对应的项
    5. 检查项是否过期
    6. 如果未过期，返回数据给客户端
    7. 如果过期，删除项并返回NOT_FOUND
    */
    
    // GET命令处理示例
    public static class GetCommandHandler {
        
        public void handleGet(String key) {
            // 1. 查找键对应的项
            Item item = StorageEngine.getInstance().getItem(key);
            
            if (item != null) {
                // 2. 检查项是否过期
                if (isExpired(item)) {
                    // 3. 如果过期，删除项
                    StorageEngine.getInstance().deleteItem(key);
                    sendNotFoundResponse();
                } else {
                    // 4. 更新最后访问时间
                    item.setLastAccessTime(System.currentTimeMillis());
                    
                    // 5. 返回数据给客户端
                    sendValueResponse(item);
                }
            } else {
                // 6. 键不存在，返回NOT_FOUND
                sendNotFoundResponse();
            }
        }
        
        private boolean isExpired(Item item) {
            return System.currentTimeMillis() > item.getExpiryTime();
        }
        
        private void sendValueResponse(Item item) {
            // 构造VALUE响应
            String response = String.format("VALUE %s %d %d\r\n%s\r\nEND\r\n",
                                          item.getKey(), item.getFlags(), 
                                          item.getValue().toString().length(),
                                          item.getValue());
            sendResponse(response);
        }
        
        private void sendNotFoundResponse() {
            sendResponse("END\r\n");
        }
        
        private void sendResponse(String response) {
            // 发送响应给客户端
        }
    }
}
```

## Memcached性能优化机制

### 1. 事件驱动架构

```java
// Memcached事件驱动架构
public class EventDrivenArchitecture {
    
    /*
    Memcached使用libevent库实现事件驱动架构：
    1. 单线程事件循环
    2. 非阻塞I/O操作
    3. 事件回调机制
    4. 高效的事件处理
    */
    
    // 事件基础类
    public static class EventBase {
        private Selector selector;
        private Map<SelectableChannel, EventHandler> handlers;
        private volatile boolean running;
        
        public EventBase() throws IOException {
            this.selector = Selector.open();
            this.handlers = new ConcurrentHashMap<>();
            this.running = false;
        }
        
        public void registerListener(SelectableChannel channel, EventHandler handler) 
                throws IOException {
            channel.configureBlocking(false);
            channel.register(selector, SelectionKey.OP_READ);
            handlers.put(channel, handler);
        }
        
        public void start() {
            running = true;
            while (running) {
                try {
                    // 等待事件
                    selector.select(1000); // 1秒超时
                    
                    // 处理事件
                    Set<SelectionKey> selectedKeys = selector.selectedKeys();
                    Iterator<SelectionKey> iterator = selectedKeys.iterator();
                    
                    while (iterator.hasNext()) {
                        SelectionKey key = iterator.next();
                        iterator.remove();
                        
                        if (key.isReadable()) {
                            SelectableChannel channel = key.channel();
                            EventHandler handler = handlers.get(channel);
                            if (handler != null) {
                                handler.handleEvent();
                            }
                        }
                    }
                } catch (IOException e) {
                    log.error("Error in event loop", e);
                }
            }
        }
        
        public void shutdown() {
            running = false;
            try {
                selector.close();
            } catch (IOException e) {
                log.warn("Error closing selector", e);
            }
        }
    }
    
    // 事件处理器接口
    public interface EventHandler {
        void handleEvent();
    }
    
    // 连接事件处理器
    public static class ConnectionEventHandler implements EventHandler {
        private SocketChannel channel;
        
        public ConnectionEventHandler(SocketChannel channel) {
            this.channel = channel;
        }
        
        @Override
        public void handleEvent() {
            try {
                // 处理连接事件
                if (channel.isOpen()) {
                    // 读取数据
                    ByteBuffer buffer = ByteBuffer.allocate(8192);
                    int bytesRead = channel.read(buffer);
                    
                    if (bytesRead > 0) {
                        // 处理读取到的数据
                        processData(buffer);
                    } else if (bytesRead == -1) {
                        // 连接关闭
                        channel.close();
                    }
                }
            } catch (IOException e) {
                log.warn("Error handling connection event", e);
                try {
                    channel.close();
                } catch (IOException ce) {
                    log.warn("Error closing channel", ce);
                }
            }
        }
        
        private void processData(ByteBuffer buffer) {
            // 处理数据的逻辑
        }
    }
}
```

### 2. 内存预分配

```java
// Memcached内存预分配机制
public class MemoryPreallocation {
    
    /*
    Memcached内存预分配特点：
    1. 启动时预分配指定大小的内存
    2. 使用Slab Allocation管理内存
    3. 避免运行时内存分配开销
    4. 减少内存碎片
    */
    
    // 内存管理器
    public static class MemoryManager {
        private static final MemoryManager INSTANCE = new MemoryManager();
        
        private long totalMemory;
        private long usedMemory;
        private Map<Integer, SlabClass> slabClasses;
        
        public static MemoryManager getInstance() {
            return INSTANCE;
        }
        
        private MemoryManager() {
            this.slabClasses = new ConcurrentHashMap<>();
            initializeSlabClasses();
        }
        
        private void initializeSlabClasses() {
            // 初始化不同大小的Slab类
            int[] sizes = {96, 120, 152, 192, 240, 304, 384, 480, 600, 752, 
                          944, 1184, 1480, 1856, 2320, 2904, 3632, 4544, 5680, 7104};
            
            for (int i = 0; i < sizes.length; i++) {
                slabClasses.put(i, new SlabClass(i, sizes[i]));
            }
        }
        
        public boolean hasEnoughSpace(int size) {
            // 查找合适的Slab类
            SlabClass slabClass = findSlabClass(size);
            return slabClass != null && slabClass.hasAvailableChunks();
        }
        
        public void allocateItem(Item item) {
            int size = item.getSize();
            SlabClass slabClass = findSlabClass(size);
            if (slabClass != null) {
                slabClass.allocateChunk(item);
                usedMemory += slabClass.getChunkSize();
            }
        }
        
        private SlabClass findSlabClass(int size) {
            for (SlabClass slabClass : slabClasses.values()) {
                if (slabClass.getChunkSize() >= size) {
                    return slabClass;
                }
            }
            return null;
        }
        
        public long getTotalMemory() {
            return totalMemory;
        }
        
        public long getUsedMemory() {
            return usedMemory;
        }
        
        public double getMemoryUsagePercentage() {
            return totalMemory > 0 ? (double) usedMemory / totalMemory * 100 : 0;
        }
    }
    
    // Slab类
    public static class SlabClass {
        private int id;
        private int chunkSize;
        private int chunksPerSlab;
        private Queue<Chunk> freeChunks;
        private List<Slab> slabs;
        
        public SlabClass(int id, int chunkSize) {
            this.id = id;
            this.chunkSize = chunkSize;
            this.chunksPerSlab = (1024 * 1024 - Slab.SLAB_HEADER_SIZE) / chunkSize; // 1MB slab
            this.freeChunks = new ConcurrentLinkedQueue<>();
            this.slabs = new ArrayList<>();
        }
        
        public boolean hasAvailableChunks() {
            return !freeChunks.isEmpty() || createNewSlab();
        }
        
        public void allocateChunk(Item item) {
            Chunk chunk = freeChunks.poll();
            if (chunk == null) {
                // 创建新的Slab
                createNewSlab();
                chunk = freeChunks.poll();
            }
            
            if (chunk != null) {
                chunk.setItem(item);
            }
        }
        
        private boolean createNewSlab() {
            try {
                Slab slab = new Slab(chunkSize, chunksPerSlab);
                slabs.add(slab);
                
                // 将新Slab中的所有Chunk加入空闲队列
                for (Chunk chunk : slab.getChunks()) {
                    freeChunks.offer(chunk);
                }
                
                return true;
            } catch (OutOfMemoryError e) {
                log.warn("Failed to create new slab due to memory limit");
                return false;
            }
        }
        
        public int getChunkSize() {
            return chunkSize;
        }
        
        public int getId() {
            return id;
        }
    }
    
    // Slab类
    public static class Slab {
        public static final int SLAB_HEADER_SIZE = 80;
        
        private int chunkSize;
        private int chunksPerSlab;
        private List<Chunk> chunks;
        private byte[] memory;
        
        public Slab(int chunkSize, int chunksPerSlab) {
            this.chunkSize = chunkSize;
            this.chunksPerSlab = chunksPerSlab;
            this.chunks = new ArrayList<>(chunksPerSlab);
            
            // 分配内存
            int totalSize = SLAB_HEADER_SIZE + chunkSize * chunksPerSlab;
            this.memory = new byte[totalSize];
            
            // 创建Chunk
            for (int i = 0; i < chunksPerSlab; i++) {
                int offset = SLAB_HEADER_SIZE + i * chunkSize;
                chunks.add(new Chunk(this, offset, chunkSize));
            }
        }
        
        public List<Chunk> getChunks() {
            return chunks;
        }
    }
    
    // Chunk类
    public static class Chunk {
        private Slab slab;
        private int offset;
        private int size;
        private Item item;
        
        public Chunk(Slab slab, int offset, int size) {
            this.slab = slab;
            this.offset = offset;
            this.size = size;
        }
        
        public void setItem(Item item) {
            this.item = item;
        }
        
        public Item getItem() {
            return item;
        }
        
        public int getSize() {
            return size;
        }
    }
}
```

## Memcached协议详解

### 1. 存储命令

```java
// Memcached存储命令协议
public class StorageCommands {
    
    /*
    SET命令：
    SET <key> <flags> <exptime> <bytes> [noreply]\r\n
    <data block>\r\n
    
    ADD命令：
    ADD <key> <flags> <exptime> <bytes> [noreply]\r\n
    <data block>\r\n
    
    REPLACE命令：
    REPLACE <key> <flags> <exptime> <bytes> [noreply]\r\n
    <data block>\r\n
    */
    
    // SET命令解析器
    public static class SetCommandParser {
        public static SetCommand parse(String commandLine, String dataBlock) {
            // SET key flags exptime bytes [noreply]
            String[] parts = commandLine.split(" ");
            if (parts.length < 5 || !parts[0].equals("SET")) {
                throw new IllegalArgumentException("Invalid SET command");
            }
            
            String key = parts[1];
            int flags = Integer.parseInt(parts[2]);
            int exptime = Integer.parseInt(parts[3]);
            int bytes = Integer.parseInt(parts[4]);
            boolean noreply = parts.length > 5 && parts[5].equals("noreply");
            
            // 验证数据块大小
            if (dataBlock.length() != bytes) {
                throw new IllegalArgumentException("Data block size mismatch");
            }
            
            return new SetCommand(key, flags, exptime, dataBlock, noreply);
        }
    }
    
    // SET命令类
    public static class SetCommand {
        private String key;
        private int flags;
        private int exptime;
        private String data;
        private boolean noreply;
        
        public SetCommand(String key, int flags, int exptime, String data, boolean noreply) {
            this.key = key;
            this.flags = flags;
            this.exptime = exptime;
            this.data = data;
            this.noreply = noreply;
        }
        
        // getter方法...
    }
}
```

### 2. 检索命令

```java
// Memcached检索命令协议
public class RetrievalCommands {
    
    /*
    GET命令：
    GET <key>*\r\n
    
    GETS命令：
    GETS <key>*\r\n
    */
    
    // GET命令解析器
    public static class GetCommandParser {
        public static GetCommand parse(String commandLine) {
            // GET key1 key2 key3...
            String[] parts = commandLine.split(" ");
            if (parts.length < 2 || !parts[0].equals("GET")) {
                throw new IllegalArgumentException("Invalid GET command");
            }
            
            String[] keys = new String[parts.length - 1];
            System.arraycopy(parts, 1, keys, 0, keys.length);
            
            return new GetCommand(keys);
        }
    }
    
    // GET命令类
    public static class GetCommand {
        private String[] keys;
        
        public GetCommand(String[] keys) {
            this.keys = keys;
        }
        
        public String[] getKeys() {
            return keys;
        }
    }
}
```

## 总结

Memcached的架构与工作原理体现了其作为高性能缓存系统的设计哲学：

1. **简单性设计**：采用简单的键值存储模型和文本协议，降低了使用复杂度
2. **高性能架构**：基于事件驱动和预分配内存机制，实现了高并发处理能力
3. **分布式特性**：通过客户端分片实现水平扩展
4. **内存管理优化**：使用Slab Allocation避免内存碎片，提高内存利用率

关键要点：

- 理解Memcached的客户端-服务器架构和工作流程
- 掌握Memcached的内存管理机制和Slab Allocation原理
- 熟悉Memcached的协议格式和命令处理流程
- 了解Memcached的性能优化机制和事件驱动架构

在下一节中，我们将深入探讨Memcached的内存管理与LRU淘汰策略，这是其高性能的关键所在。