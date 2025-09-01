---
title: 阻塞 IO / NIO / Netty 基础
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在网络编程领域，IO（Input/Output）模型的选择对系统的性能和可扩展性有着至关重要的影响。从传统的阻塞IO到现代的NIO（Non-blocking IO），再到功能强大的Netty框架，每种技术都有其独特的优势和适用场景。本章将深入探讨这三种IO模型的基础知识，为构建高性能的RPC框架奠定理论基础。

## 阻塞 IO（BIO）

### 什么是阻塞 IO

阻塞IO是最传统的IO模型，也是最容易理解和实现的。在阻塞IO模型中，当应用程序发起IO请求时，线程会被阻塞，直到IO操作完成。

### 阻塞 IO 的特点

1. **同步阻塞**：线程在等待IO操作完成期间完全阻塞
2. **一对一连接**：每个连接需要一个独立的线程处理
3. **资源消耗大**：大量并发连接会消耗大量线程资源
4. **实现简单**：代码逻辑直观，易于理解和维护

### 阻塞 IO 示例

```java
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

// 阻塞 IO 服务端示例
public class BlockingIOServer {
    private ServerSocket serverSocket;
    private ExecutorService threadPool;
    private volatile boolean running = false;
    
    public BlockingIOServer() {
        // 创建固定大小的线程池
        this.threadPool = Executors.newFixedThreadPool(50);
    }
    
    public void start(int port) throws IOException {
        serverSocket = new ServerSocket(port);
        running = true;
        System.out.println("Blocking IO Server started on port " + port);
        
        while (running) {
            try {
                // 阻塞等待客户端连接
                Socket clientSocket = serverSocket.accept();
                System.out.println("Client connected: " + clientSocket.getRemoteSocketAddress());
                
                // 为每个连接分配一个线程处理
                threadPool.submit(new BlockingIOHandler(clientSocket));
            } catch (IOException e) {
                if (running) {
                    System.err.println("Error accepting connection: " + e.getMessage());
                }
            }
        }
    }
    
    public void stop() throws IOException {
        running = false;
        if (serverSocket != null) {
            serverSocket.close();
        }
        if (threadPool != null) {
            threadPool.shutdown();
        }
    }
}

// 阻塞 IO 处理器
class BlockingIOHandler implements Runnable {
    private Socket clientSocket;
    
    public BlockingIOHandler(Socket clientSocket) {
        this.clientSocket = clientSocket;
    }
    
    @Override
    public void run() {
        try (BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
             PrintWriter out = new PrintWriter(clientSocket.getOutputStream(), true)) {
            
            String inputLine;
            // 阻塞读取客户端数据
            while ((inputLine = in.readLine()) != null) {
                System.out.println("Received: " + inputLine);
                
                // 处理请求
                String response = processRequest(inputLine);
                
                // 阻塞发送响应
                out.println(response);
                
                if ("bye".equalsIgnoreCase(inputLine.trim())) {
                    break;
                }
            }
        } catch (IOException e) {
            System.err.println("Error handling client: " + e.getMessage());
        } finally {
            try {
                clientSocket.close();
                System.out.println("Client disconnected: " + clientSocket.getRemoteSocketAddress());
            } catch (IOException e) {
                System.err.println("Error closing socket: " + e.getMessage());
            }
        }
    }
    
    private String processRequest(String request) {
        // 模拟处理时间
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        if (request.startsWith("echo:")) {
            return "Echo: " + request.substring(5);
        } else if ("time".equalsIgnoreCase(request)) {
            return "Server time: " + new java.util.Date().toString();
        } else {
            return "Unknown command: " + request;
        }
    }
}

// 阻塞 IO 客户端示例
public class BlockingIOClient {
    private String host;
    private int port;
    private Socket socket;
    private BufferedReader in;
    private PrintWriter out;
    
    public BlockingIOClient(String host, int port) {
        this.host = host;
        this.port = port;
    }
    
    public void connect() throws IOException {
        socket = new Socket(host, port);
        in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
        out = new PrintWriter(socket.getOutputStream(), true);
        System.out.println("Connected to server");
    }
    
    public String sendRequest(String request) throws IOException {
        // 阻塞发送请求
        out.println(request);
        
        // 阻塞等待响应
        return in.readLine();
    }
    
    public void disconnect() throws IOException {
        if (in != null) in.close();
        if (out != null) out.close();
        if (socket != null) socket.close();
        System.out.println("Disconnected from server");
    }
    
    public static void main(String[] args) {
        BlockingIOClient client = new BlockingIOClient("localhost", 8080);
        try {
            client.connect();
            
            // 发送多个请求测试
            for (int i = 0; i < 5; i++) {
                String response = client.sendRequest("echo:Hello " + i);
                System.out.println("Response: " + response);
                
                Thread.sleep(1000);
            }
            
            client.sendRequest("bye");
        } catch (Exception e) {
            System.err.println("Client error: " + e.getMessage());
        } finally {
            try {
                client.disconnect();
            } catch (IOException e) {
                System.err.println("Error disconnecting: " + e.getMessage());
            }
        }
    }
}
```

### 阻塞 IO 的局限性

1. **线程资源消耗**：每个连接需要一个线程，大量连接会导致线程资源耗尽
2. **上下文切换开销**：大量线程间的上下文切换会消耗CPU资源
3. **扩展性差**：难以支持高并发场景
4. **阻塞等待**：线程在IO操作期间完全阻塞，无法执行其他任务

## NIO（Non-blocking IO）

### 什么是 NIO

NIO（New IO 或 Non-blocking IO）是Java 1.4引入的IO模型，它提供了非阻塞的IO操作能力。NIO基于通道（Channel）和缓冲区（Buffer）的概念，通过选择器（Selector）实现单线程管理多个连接。

### NIO 的核心组件

1. **Buffer（缓冲区）**：用于存储数据的容器
2. **Channel（通道）**：表示到实体（如文件、硬件设备或网络套接字）的开放连接
3. **Selector（选择器）**：用于监控多个Channel的状态变化

### NIO 的特点

1. **非阻塞**：IO操作不会阻塞线程
2. **事件驱动**：通过事件机制处理IO操作
3. **单线程多路复用**：单个线程可以管理多个连接
4. **高性能**：减少了线程创建和上下文切换的开销

### NIO 示例

```java
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.*;
import java.util.Iterator;
import java.util.Set;

// NIO 服务端示例
public class NIOServer {
    private Selector selector;
    private ServerSocketChannel serverChannel;
    private volatile boolean running = false;
    
    public void start(int port) throws IOException {
        // 创建选择器
        selector = Selector.open();
        
        // 创建服务端通道
        serverChannel = ServerSocketChannel.open();
        serverChannel.configureBlocking(false); // 设置为非阻塞模式
        serverChannel.bind(new InetSocketAddress(port));
        
        // 将通道注册到选择器上，监听连接事件
        serverChannel.register(selector, SelectionKey.OP_ACCEPT);
        
        running = true;
        System.out.println("NIO Server started on port " + port);
        
        // 事件循环
        while (running) {
            try {
                // 等待事件发生，阻塞时间为1秒
                int readyChannels = selector.select(1000);
                if (readyChannels == 0) {
                    continue;
                }
                
                // 获取就绪的事件
                Set<SelectionKey> selectedKeys = selector.selectedKeys();
                Iterator<SelectionKey> keyIterator = selectedKeys.iterator();
                
                while (keyIterator.hasNext()) {
                    SelectionKey key = keyIterator.next();
                    
                    if (key.isAcceptable()) {
                        // 处理连接事件
                        handleAccept(key);
                    } else if (key.isReadable()) {
                        // 处理读事件
                        handleRead(key);
                    } else if (key.isWritable()) {
                        // 处理写事件
                        handleWrite(key);
                    }
                    
                    keyIterator.remove();
                }
            } catch (IOException e) {
                System.err.println("Error in NIO server: " + e.getMessage());
            }
        }
    }
    
    private void handleAccept(SelectionKey key) throws IOException {
        ServerSocketChannel serverChannel = (ServerSocketChannel) key.channel();
        SocketChannel clientChannel = serverChannel.accept();
        clientChannel.configureBlocking(false);
        
        System.out.println("Client connected: " + clientChannel.getRemoteAddress());
        
        // 将客户端通道注册到选择器，监听读事件
        clientChannel.register(selector, SelectionKey.OP_READ);
    }
    
    private void handleRead(SelectionKey key) throws IOException {
        SocketChannel clientChannel = (SocketChannel) key.channel();
        ByteBuffer buffer = ByteBuffer.allocate(1024);
        
        try {
            int bytesRead = clientChannel.read(buffer);
            if (bytesRead == -1) {
                // 客户端关闭连接
                System.out.println("Client disconnected: " + clientChannel.getRemoteAddress());
                clientChannel.close();
                return;
            }
            
            if (bytesRead > 0) {
                buffer.flip();
                byte[] data = new byte[buffer.remaining()];
                buffer.get(data);
                String message = new String(data).trim();
                
                System.out.println("Received: " + message);
                
                // 准备响应数据
                String response = processRequest(message);
                ByteBuffer responseBuffer = ByteBuffer.wrap((response + "\n").getBytes());
                
                // 将通道注册为可写状态
                clientChannel.register(selector, SelectionKey.OP_WRITE, responseBuffer);
            }
        } catch (IOException e) {
            System.err.println("Error reading from client: " + e.getMessage());
            clientChannel.close();
        }
    }
    
    private void handleWrite(SelectionKey key) throws IOException {
        SocketChannel clientChannel = (SocketChannel) key.channel();
        ByteBuffer responseBuffer = (ByteBuffer) key.attachment();
        
        if (responseBuffer != null) {
            clientChannel.write(responseBuffer);
            
            if (!responseBuffer.hasRemaining()) {
                // 数据发送完毕，重新注册为可读状态
                clientChannel.register(selector, SelectionKey.OP_READ);
            }
        }
    }
    
    private String processRequest(String request) {
        // 模拟处理时间
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        if (request.startsWith("echo:")) {
            return "Echo: " + request.substring(5);
        } else if ("time".equalsIgnoreCase(request)) {
            return "Server time: " + new java.util.Date().toString();
        } else if ("bye".equalsIgnoreCase(request)) {
            return "Goodbye!";
        } else {
            return "Unknown command: " + request;
        }
    }
    
    public void stop() throws IOException {
        running = false;
        if (serverChannel != null) {
            serverChannel.close();
        }
        if (selector != null) {
            selector.close();
        }
    }
    
    public static void main(String[] args) {
        NIOServer server = new NIOServer();
        try {
            server.start(8080);
        } catch (IOException e) {
            System.err.println("Server error: " + e.getMessage());
        }
    }
}

// NIO 客户端示例
public class NIOClient {
    private String host;
    private int port;
    private SocketChannel socketChannel;
    private Selector selector;
    
    public NIOClient(String host, int port) {
        this.host = host;
        this.port = port;
    }
    
    public void connect() throws IOException {
        socketChannel = SocketChannel.open();
        socketChannel.configureBlocking(false);
        socketChannel.connect(new InetSocketAddress(host, port));
        
        selector = Selector.open();
        socketChannel.register(selector, SelectionKey.OP_CONNECT);
        
        // 等待连接完成
        while (socketChannel.isConnectionPending()) {
            socketChannel.finishConnect();
        }
        
        System.out.println("Connected to server");
    }
    
    public String sendRequest(String request) throws IOException {
        // 发送请求
        ByteBuffer requestBuffer = ByteBuffer.wrap((request + "\n").getBytes());
        socketChannel.write(requestBuffer);
        
        // 等待响应
        ByteBuffer responseBuffer = ByteBuffer.allocate(1024);
        int bytesRead = socketChannel.read(responseBuffer);
        
        if (bytesRead > 0) {
            responseBuffer.flip();
            byte[] data = new byte[responseBuffer.remaining()];
            responseBuffer.get(data);
            return new String(data).trim();
        }
        
        return null;
    }
    
    public void disconnect() throws IOException {
        if (socketChannel != null) {
            socketChannel.close();
        }
        if (selector != null) {
            selector.close();
        }
        System.out.println("Disconnected from server");
    }
    
    public static void main(String[] args) {
        NIOClient client = new NIOClient("localhost", 8080);
        try {
            client.connect();
            
            // 发送多个请求测试
            for (int i = 0; i < 5; i++) {
                String response = client.sendRequest("echo:Hello " + i);
                System.out.println("Response: " + response);
                
                Thread.sleep(1000);
            }
            
            client.sendRequest("bye");
            client.disconnect();
        } catch (Exception e) {
            System.err.println("Client error: " + e.getMessage());
        }
    }
}
```

### NIO 的优势

1. **高并发支持**：单线程可以处理多个连接
2. **资源利用率高**：减少了线程创建和上下文切换的开销
3. **非阻塞操作**：线程不会因为IO操作而阻塞
4. **事件驱动**：基于事件的处理机制更加高效

### NIO 的局限性

1. **编程复杂度高**：需要处理复杂的事件循环和状态管理
2. **粘包拆包问题**：需要手动处理TCP粘包和拆包问题
3. **调试困难**：异步编程模式增加了调试难度
4. **错误处理复杂**：需要处理各种异常情况

## Netty 基础

### 什么是 Netty

Netty是一个基于NIO的高性能网络应用框架，它封装了NIO的复杂性，提供了简单易用的API，使得开发网络应用变得更加容易。Netty广泛应用于各种高性能服务器和客户端应用中。

### Netty 的核心特性

1. **事件驱动**：基于事件驱动的异步编程模型
2. **零拷贝**：通过零拷贝技术提高性能
3. **内存管理**：高效的内存管理和缓冲区复用
4. **协议支持**：支持多种网络协议
5. **线程模型**：灵活的线程模型配置

### Netty 的核心组件

1. **Bootstrap**：用于配置和启动客户端或服务端
2. **Channel**：表示网络连接
3. **EventLoop**：处理连接的生命周期和事件
4. **ChannelPipeline**：处理入站和出站数据的处理器链
5. **ChannelHandler**：处理网络事件的处理器

### Netty 示例

```java
import io.netty.bootstrap.ServerBootstrap;
import io.netty.bootstrap.Bootstrap;
import io.netty.channel.*;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.channel.socket.nio.NioSocketChannel;
import io.netty.handler.codec.LineBasedFrameDecoder;
import io.netty.handler.codec.string.StringDecoder;
import io.netty.handler.codec.string.StringEncoder;
import io.netty.util.CharsetUtil;

// Netty 服务端示例
public class NettyServer {
    private int port;
    private EventLoopGroup bossGroup;
    private EventLoopGroup workerGroup;
    private ChannelFuture channelFuture;
    
    public NettyServer(int port) {
        this.port = port;
    }
    
    public void start() throws InterruptedException {
        // 创建两个EventLoopGroup
        bossGroup = new NioEventLoopGroup(1); // 接收连接
        workerGroup = new NioEventLoopGroup(); // 处理连接
        
        try {
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ChannelPipeline pipeline = ch.pipeline();
                            
                            // 添加编解码器
                            pipeline.addLast(new LineBasedFrameDecoder(1024));
                            pipeline.addLast(new StringDecoder(CharsetUtil.UTF_8));
                            pipeline.addLast(new StringEncoder(CharsetUtil.UTF_8));
                            
                            // 添加业务处理器
                            pipeline.addLast(new NettyServerHandler());
                        }
                    })
                    .option(ChannelOption.SO_BACKLOG, 128)
                    .childOption(ChannelOption.SO_KEEPALIVE, true);
            
            // 绑定端口并启动服务
            channelFuture = bootstrap.bind(port).sync();
            System.out.println("Netty Server started on port " + port);
            
            // 等待服务关闭
            channelFuture.channel().closeFuture().sync();
        } finally {
            // 优雅关闭
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
    
    public void stop() {
        if (channelFuture != null) {
            channelFuture.channel().close();
        }
    }
}

// Netty 服务端处理器
@ChannelHandler.Sharable
class NettyServerHandler extends SimpleChannelInboundHandler<String> {
    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        System.out.println("Client connected: " + ctx.channel().remoteAddress());
        super.channelActive(ctx);
    }
    
    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        System.out.println("Client disconnected: " + ctx.channel().remoteAddress());
        super.channelInactive(ctx);
    }
    
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, String msg) throws Exception {
        System.out.println("Received: " + msg);
        
        // 处理请求
        String response = processRequest(msg);
        
        // 发送响应
        ctx.writeAndFlush(response + "\n");
    }
    
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        System.err.println("Exception caught: " + cause.getMessage());
        ctx.close();
    }
    
    private String processRequest(String request) {
        // 模拟处理时间
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        if (request.startsWith("echo:")) {
            return "Echo: " + request.substring(5);
        } else if ("time".equalsIgnoreCase(request)) {
            return "Server time: " + new java.util.Date().toString();
        } else if ("bye".equalsIgnoreCase(request)) {
            return "Goodbye!";
        } else {
            return "Unknown command: " + request;
        }
    }
}

// Netty 客户端示例
public class NettyClient {
    private String host;
    private int port;
    private EventLoopGroup group;
    private Channel channel;
    
    public NettyClient(String host, int port) {
        this.host = host;
        this.port = port;
    }
    
    public void connect() throws InterruptedException {
        group = new NioEventLoopGroup();
        
        try {
            Bootstrap bootstrap = new Bootstrap();
            bootstrap.group(group)
                    .channel(NioSocketChannel.class)
                    .handler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ChannelPipeline pipeline = ch.pipeline();
                            
                            // 添加编解码器
                            pipeline.addLast(new LineBasedFrameDecoder(1024));
                            pipeline.addLast(new StringDecoder(CharsetUtil.UTF_8));
                            pipeline.addLast(new StringEncoder(CharsetUtil.UTF_8));
                            
                            // 添加客户端处理器
                            pipeline.addLast(new NettyClientHandler());
                        }
                    });
            
            // 连接到服务端
            ChannelFuture future = bootstrap.connect(host, port).sync();
            channel = future.channel();
            System.out.println("Connected to server");
        } catch (InterruptedException e) {
            group.shutdownGracefully();
            throw e;
        }
    }
    
    public String sendRequest(String request) throws InterruptedException {
        if (channel != null && channel.isActive()) {
            // 发送请求并等待响应
            ChannelFuture future = channel.writeAndFlush(request + "\n");
            future.sync();
            
            // 这里简化处理，实际应用中需要更复杂的响应处理机制
            return "Response sent";
        }
        return null;
    }
    
    public void disconnect() {
        if (channel != null) {
            channel.close();
        }
        if (group != null) {
            group.shutdownGracefully();
        }
        System.out.println("Disconnected from server");
    }
    
    public static void main(String[] args) {
        NettyClient client = new NettyClient("localhost", 8080);
        try {
            client.connect();
            
            // 发送多个请求测试
            for (int i = 0; i < 5; i++) {
                client.sendRequest("echo:Hello " + i);
                System.out.println("Sent request: echo:Hello " + i);
                
                Thread.sleep(1000);
            }
            
            client.sendRequest("bye");
            client.disconnect();
        } catch (Exception e) {
            System.err.println("Client error: " + e.getMessage());
        }
    }
}

// Netty 客户端处理器
class NettyClientHandler extends SimpleChannelInboundHandler<String> {
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, String msg) throws Exception {
        System.out.println("Received response: " + msg);
    }
    
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        System.err.println("Client exception: " + cause.getMessage());
        ctx.close();
    }
}
```

### Netty 的优势

1. **高性能**：基于NIO，提供卓越的性能
2. **易用性**：封装了NIO的复杂性，提供简单易用的API
3. **稳定性**：经过大量生产环境验证，稳定可靠
4. **丰富的功能**：支持多种编解码器、协议和特性
5. **社区支持**：活跃的社区和丰富的文档

### Netty 的适用场景

1. **高性能服务器**：需要处理大量并发连接的服务器
2. **实时通信应用**：如聊天应用、游戏服务器等
3. **RPC框架**：许多主流RPC框架都基于Netty实现
4. **消息中间件**：如RocketMQ、Kafka等
5. **HTTP服务器**：如Netty本身提供的HTTP服务器

## 三种 IO 模型对比

### 性能对比

| 特性 | 阻塞 IO | NIO | Netty |
|------|---------|-----|-------|
| 并发处理能力 | 低 | 高 | 高 |
| 资源消耗 | 高 | 低 | 低 |
| 编程复杂度 | 低 | 高 | 中等 |
| 性能 | 低 | 高 | 很高 |
| 稳定性 | 高 | 中等 | 高 |

### 适用场景

1. **阻塞 IO**：适用于连接数较少、业务逻辑简单的场景
2. **NIO**：适用于需要自定义网络协议、对性能有较高要求的场景
3. **Netty**：适用于需要快速开发高性能网络应用的场景

## 总结

通过本章的学习，我们深入了解了阻塞IO、NIO和Netty三种网络编程模型的特点和适用场景：

1. **阻塞IO**简单易用，但扩展性差，适用于连接数较少的场景
2. **NIO**提供了非阻塞的IO操作能力，支持高并发，但编程复杂度较高
3. **Netty**封装了NIO的复杂性，提供了高性能、易用的网络编程框架

在构建RPC框架时，选择合适的IO模型对系统性能至关重要。对于大多数RPC框架来说，Netty是首选方案，因为它既提供了高性能，又简化了开发复杂度。

在下一章中，我们将基于这些IO模型的知识，学习如何使用Netty封装RPC请求和响应，进一步提升RPC框架的性能和可靠性。