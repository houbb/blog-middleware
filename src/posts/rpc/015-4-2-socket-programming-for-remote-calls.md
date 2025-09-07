---
title: Socket 编程实现远程调用
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

Socket 编程是实现 RPC（Remote Procedure Call）框架的基础技术之一。通过 Socket，我们可以在网络上的不同进程之间建立连接并传输数据，从而实现远程方法调用。本章将深入探讨如何使用 Socket 编程实现基本的远程调用功能，为后续实现完整的 RPC 框架奠定基础。

## Socket 编程基础

### 什么是 Socket

Socket 是网络编程中的一个抽象概念，它是应用层与 TCP/IP 协议族通信的中间软件抽象层。Socket 提供了一组接口，使得应用程序可以通过网络与其他应用程序进行通信。

### Socket 的类型

在 Java 中，主要有两种类型的 Socket：

1. **ServerSocket**：服务端 Socket，用于监听客户端连接请求
2. **Socket**：客户端 Socket，用于与服务端建立连接

### Socket 通信模型

Socket 通信遵循典型的客户端-服务端模型：

1. 服务端创建 ServerSocket 并绑定到特定端口
2. 服务端调用 accept() 方法等待客户端连接
3. 客户端创建 Socket 并连接到服务端
4. 服务端接受连接，创建新的 Socket 与客户端通信
5. 双方通过输入输出流进行数据传输
6. 通信结束后关闭连接

## 基础 Socket 实现

### 简单的 Socket 服务端

让我们从一个简单的 Socket 服务端开始：

```java
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

// 简单的 Socket 服务端实现
public class SimpleSocketServer {
    private int port;
    private ServerSocket serverSocket;
    private ExecutorService threadPool;
    
    public SimpleSocketServer(int port) {
        this.port = port;
        // 创建线程池处理客户端连接
        this.threadPool = Executors.newFixedThreadPool(10);
    }
    
    public void start() throws IOException {
        serverSocket = new ServerSocket(port);
        System.out.println("Socket Server started on port " + port);
        
        while (!Thread.currentThread().isInterrupted()) {
            try {
                // 等待客户端连接
                Socket clientSocket = serverSocket.accept();
                System.out.println("Client connected: " + clientSocket.getRemoteSocketAddress());
                
                // 使用线程池处理客户端请求
                threadPool.submit(new ClientHandler(clientSocket));
            } catch (IOException e) {
                if (!serverSocket.isClosed()) {
                    System.err.println("Error accepting client connection: " + e.getMessage());
                }
            }
        }
    }
    
    public void stop() throws IOException {
        if (serverSocket != null && !serverSocket.isClosed()) {
            serverSocket.close();
        }
        if (threadPool != null) {
            threadPool.shutdown();
        }
    }
    
    // 客户端处理器
    private static class ClientHandler implements Runnable {
        private Socket clientSocket;
        
        public ClientHandler(Socket clientSocket) {
            this.clientSocket = clientSocket;
        }
        
        @Override
        public void run() {
            try (BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
                 PrintWriter out = new PrintWriter(clientSocket.getOutputStream(), true)) {
                
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    System.out.println("Received from client: " + inputLine);
                    
                    // 简单的回显服务
                    if ("bye".equalsIgnoreCase(inputLine.trim())) {
                        out.println("Goodbye!");
                        break;
                    }
                    
                    // 处理请求并返回响应
                    String response = processRequest(inputLine);
                    out.println(response);
                }
            } catch (IOException e) {
                System.err.println("Error handling client: " + e.getMessage());
            } finally {
                try {
                    clientSocket.close();
                    System.out.println("Client disconnected: " + clientSocket.getRemoteSocketAddress());
                } catch (IOException e) {
                    System.err.println("Error closing client socket: " + e.getMessage());
                }
            }
        }
        
        private String processRequest(String request) {
            // 简单的请求处理逻辑
            if (request.startsWith("echo:")) {
                return "Echo: " + request.substring(5);
            } else if (request.startsWith("time")) {
                return "Server time: " + new java.util.Date().toString();
            } else {
                return "Unknown command: " + request;
            }
        }
    }
}
```

### 简单的 Socket 客户端

对应的客户端实现：

```java
import java.io.*;
import java.net.*;

// 简单的 Socket 客户端实现
public class SimpleSocketClient {
    private String host;
    private int port;
    private Socket socket;
    private BufferedReader in;
    private PrintWriter out;
    
    public SimpleSocketClient(String host, int port) {
        this.host = host;
        this.port = port;
    }
    
    public void connect() throws IOException {
        socket = new Socket(host, port);
        in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
        out = new PrintWriter(socket.getOutputStream(), true);
        System.out.println("Connected to server: " + host + ":" + port);
    }
    
    public void sendMessage(String message) throws IOException {
        if (out != null) {
            out.println(message);
        }
    }
    
    public String receiveMessage() throws IOException {
        if (in != null) {
            return in.readLine();
        }
        return null;
    }
    
    public void disconnect() throws IOException {
        if (in != null) in.close();
        if (out != null) out.close();
        if (socket != null) socket.close();
        System.out.println("Disconnected from server");
    }
    
    // 交互式客户端
    public void startInteractiveSession() throws IOException {
        BufferedReader console = new BufferedReader(new InputStreamReader(System.in));
        
        System.out.println("Enter messages (type 'bye' to quit):");
        
        String userInput;
        while ((userInput = console.readLine()) != null) {
            // 发送消息
            sendMessage(userInput);
            
            // 接收响应
            String response = receiveMessage();
            System.out.println("Server: " + response);
            
            // 检查是否应该退出
            if ("bye".equalsIgnoreCase(userInput.trim()) || 
                "Goodbye!".equals(response)) {
                break;
            }
        }
    }
    
    public static void main(String[] args) {
        try {
            SimpleSocketClient client = new SimpleSocketClient("localhost", 8080);
            client.connect();
            client.startInteractiveSession();
            client.disconnect();
        } catch (IOException e) {
            System.err.println("Client error: " + e.getMessage());
        }
    }
}
```

## 基于对象的 Socket 通信

为了实现真正的远程方法调用，我们需要能够传输复杂的对象。让我们实现一个基于对象的 Socket 通信系统：

### 请求和响应对象

```java
import java.io.Serializable;

// RPC 请求对象
public class RpcRequest implements Serializable {
    private static final long serialVersionUID = 1L;
    
    private String requestId;
    private String serviceName;
    private String methodName;
    private Class<?>[] parameterTypes;
    private Object[] parameters;
    
    public RpcRequest() {
        this.requestId = java.util.UUID.randomUUID().toString();
    }
    
    // 构造函数
    public RpcRequest(String serviceName, String methodName, Class<?>[] parameterTypes, Object[] parameters) {
        this();
        this.serviceName = serviceName;
        this.methodName = methodName;
        this.parameterTypes = parameterTypes;
        this.parameters = parameters;
    }
    
    // getter 和 setter 方法
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    
    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    
    public String getMethodName() { return methodName; }
    public void setMethodName(String methodName) { this.methodName = methodName; }
    
    public Class<?>[] getParameterTypes() { return parameterTypes; }
    public void setParameterTypes(Class<?>[] parameterTypes) { this.parameterTypes = parameterTypes; }
    
    public Object[] getParameters() { return parameters; }
    public void setParameters(Object[] parameters) { this.parameters = parameters; }
    
    @Override
    public String toString() {
        return "RpcRequest{" +
                "requestId='" + requestId + '\'' +
                ", serviceName='" + serviceName + '\'' +
                ", methodName='" + methodName + '\'' +
                ", parameterTypes=" + java.util.Arrays.toString(parameterTypes) +
                ", parameters=" + java.util.Arrays.toString(parameters) +
                '}';
    }
}

// RPC 响应对象
public class RpcResponse implements Serializable {
    private static final long serialVersionUID = 1L;
    
    private String requestId;
    private Object data;
    private Exception exception;
    
    public RpcResponse() {}
    
    public RpcResponse(String requestId) {
        this.requestId = requestId;
    }
    
    // getter 和 setter 方法
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    
    public Object getData() { return data; }
    public void setData(Object data) { this.data = data; }
    
    public Exception getException() { return exception; }
    public void setException(Exception exception) { this.exception = exception; }
    
    public boolean hasError() {
        return exception != null;
    }
    
    @Override
    public String toString() {
        return "RpcResponse{" +
                "requestId='" + requestId + '\'' +
                ", data=" + data +
                ", exception=" + exception +
                '}';
    }
}
```

### 对象序列化工具

```java
import java.io.*;

// 对象序列化工具
public class ObjectSerializer {
    
    // 序列化对象
    public static byte[] serialize(Object obj) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ObjectOutputStream oos = new ObjectOutputStream(bos);
        oos.writeObject(obj);
        oos.close();
        return bos.toByteArray();
    }
    
    // 反序列化对象
    public static Object deserialize(byte[] data) throws IOException, ClassNotFoundException {
        ByteArrayInputStream bis = new ByteArrayInputStream(data);
        ObjectInputStream ois = new ObjectInputStream(bis);
        Object obj = ois.readObject();
        ois.close();
        return obj;
    }
    
    // 带长度前缀的序列化（用于网络传输）
    public static byte[] serializeWithLength(Object obj) throws IOException {
        byte[] data = serialize(obj);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        DataOutputStream dos = new DataOutputStream(bos);
        dos.writeInt(data.length);
        dos.write(data);
        dos.close();
        return bos.toByteArray();
    }
    
    // 带长度前缀的反序列化
    public static Object deserializeWithLength(InputStream inputStream) 
            throws IOException, ClassNotFoundException {
        DataInputStream dis = new DataInputStream(inputStream);
        int length = dis.readInt();
        byte[] data = new byte[length];
        dis.readFully(data);
        return deserialize(data);
    }
}
```

### 基于对象的 Socket 服务端

```java
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

// 基于对象的 Socket 服务端
public class ObjectSocketServer {
    private int port;
    private ServerSocket serverSocket;
    private ExecutorService threadPool;
    private ServiceRegistry serviceRegistry;
    
    public ObjectSocketServer(int port) {
        this.port = port;
        this.threadPool = Executors.newFixedThreadPool(20);
        this.serviceRegistry = new ServiceRegistry();
    }
    
    public void start() throws IOException {
        serverSocket = new ServerSocket(port);
        System.out.println("Object Socket Server started on port " + port);
        
        // 注册示例服务
        serviceRegistry.registerService("CalculatorService", new CalculatorService());
        
        while (!Thread.currentThread().isInterrupted()) {
            try {
                Socket clientSocket = serverSocket.accept();
                System.out.println("Client connected: " + clientSocket.getRemoteSocketAddress());
                threadPool.submit(new ObjectClientHandler(clientSocket, serviceRegistry));
            } catch (IOException e) {
                if (!serverSocket.isClosed()) {
                    System.err.println("Error accepting client connection: " + e.getMessage());
                }
            }
        }
    }
    
    public void stop() throws IOException {
        if (serverSocket != null && !serverSocket.isClosed()) {
            serverSocket.close();
        }
        if (threadPool != null) {
            threadPool.shutdown();
        }
    }
    
    public void registerService(String serviceName, Object serviceImpl) {
        serviceRegistry.registerService(serviceName, serviceImpl);
    }
}

// 对象客户端处理器
class ObjectClientHandler implements Runnable {
    private Socket clientSocket;
    private ServiceRegistry serviceRegistry;
    
    public ObjectClientHandler(Socket clientSocket, ServiceRegistry serviceRegistry) {
        this.clientSocket = clientSocket;
        this.serviceRegistry = serviceRegistry;
    }
    
    @Override
    public void run() {
        try (ObjectInputStream objectInput = new ObjectInputStream(clientSocket.getInputStream());
             ObjectOutputStream objectOutput = new ObjectOutputStream(clientSocket.getOutputStream())) {
            
            while (!clientSocket.isClosed()) {
                try {
                    // 读取请求对象
                    RpcRequest request = (RpcRequest) objectInput.readObject();
                    System.out.println("Received request: " + request);
                    
                    // 处理请求
                    RpcResponse response = handleRequest(request);
                    
                    // 发送响应
                    objectOutput.writeObject(response);
                    objectOutput.flush();
                    
                } catch (ClassNotFoundException e) {
                    System.err.println("Class not found: " + e.getMessage());
                    break;
                } catch (EOFException e) {
                    // 客户端断开连接
                    System.out.println("Client disconnected");
                    break;
                } catch (IOException e) {
                    System.err.println("IO error: " + e.getMessage());
                    break;
                } catch (Exception e) {
                    System.err.println("Error processing request: " + e.getMessage());
                    // 发送错误响应
                    RpcResponse errorResponse = new RpcResponse();
                    errorResponse.setException(e);
                    try {
                        ObjectOutputStream errorOutput = new ObjectOutputStream(clientSocket.getOutputStream());
                        errorOutput.writeObject(errorResponse);
                        errorOutput.flush();
                    } catch (IOException ioException) {
                        System.err.println("Error sending error response: " + ioException.getMessage());
                    }
                }
            }
        } catch (IOException e) {
            System.err.println("Error handling client: " + e.getMessage());
        } finally {
            try {
                clientSocket.close();
                System.out.println("Client disconnected: " + clientSocket.getRemoteSocketAddress());
            } catch (IOException e) {
                System.err.println("Error closing client socket: " + e.getMessage());
            }
        }
    }
    
    private RpcResponse handleRequest(RpcRequest request) {
        RpcResponse response = new RpcResponse(request.getRequestId());
        
        try {
            // 查找服务实现
            Object serviceImpl = serviceRegistry.getService(request.getServiceName());
            if (serviceImpl == null) {
                throw new RuntimeException("Service not found: " + request.getServiceName());
            }
            
            // 获取方法
            Class<?> serviceClass = serviceImpl.getClass();
            java.lang.reflect.Method method = serviceClass.getMethod(
                request.getMethodName(), request.getParameterTypes());
            
            // 调用方法
            Object result = method.invoke(serviceImpl, request.getParameters());
            
            // 设置响应结果
            response.setData(result);
        } catch (Exception e) {
            response.setException(e);
        }
        
        return response;
    }
}

// 服务注册中心
class ServiceRegistry {
    private final java.util.Map<String, Object> services = new ConcurrentHashMap<>();
    
    public void registerService(String serviceName, Object serviceImpl) {
        services.put(serviceName, serviceImpl);
        System.out.println("Service registered: " + serviceName);
    }
    
    public Object getService(String serviceName) {
        return services.get(serviceName);
    }
}

// 示例服务实现
class CalculatorService {
    public int add(int a, int b) {
        System.out.println("Calculating " + a + " + " + b);
        return a + b;
    }
    
    public int multiply(int a, int b) {
        System.out.println("Calculating " + a + " * " + b);
        return a * b;
    }
    
    public double divide(double a, double b) {
        if (b == 0) {
            throw new IllegalArgumentException("Division by zero");
        }
        System.out.println("Calculating " + a + " / " + b);
        return a / b;
    }
}
```

### 基于对象的 Socket 客户端

```java
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

// 基于对象的 Socket 客户端
public class ObjectSocketClient {
    private String host;
    private int port;
    private Socket socket;
    private ObjectInputStream objectInput;
    private ObjectOutputStream objectOutput;
    private volatile boolean connected = false;
    
    public ObjectSocketClient(String host, int port) {
        this.host = host;
        this.port = port;
    }
    
    public void connect() throws IOException {
        socket = new Socket(host, port);
        // 注意：必须先创建 ObjectOutputStream，再创建 ObjectInputStream
        objectOutput = new ObjectOutputStream(socket.getOutputStream());
        objectInput = new ObjectInputStream(socket.getInputStream());
        connected = true;
        System.out.println("Connected to server: " + host + ":" + port);
    }
    
    public RpcResponse sendRequest(RpcRequest request) throws IOException, ClassNotFoundException {
        if (!connected) {
            throw new IllegalStateException("Not connected to server");
        }
        
        // 发送请求
        objectOutput.writeObject(request);
        objectOutput.flush();
        
        // 接收响应
        return (RpcResponse) objectInput.readObject();
    }
    
    public void disconnect() throws IOException {
        connected = false;
        if (objectInput != null) objectInput.close();
        if (objectOutput != null) objectOutput.close();
        if (socket != null) socket.close();
        System.out.println("Disconnected from server");
    }
    
    // 同步调用方法
    public Object invoke(String serviceName, String methodName, Class<?>[] paramTypes, Object[] params) 
            throws Exception {
        RpcRequest request = new RpcRequest(serviceName, methodName, paramTypes, params);
        RpcResponse response = sendRequest(request);
        
        if (response.hasError()) {
            throw response.getException();
        }
        
        return response.getData();
    }
    
    // 测试方法
    public static void main(String[] args) {
        ObjectSocketClient client = new ObjectSocketClient("localhost", 8080);
        try {
            client.connect();
            
            // 测试加法
            Object result = client.invoke(
                "CalculatorService", 
                "add", 
                new Class[]{int.class, int.class}, 
                new Object[]{10, 20}
            );
            System.out.println("10 + 20 = " + result);
            
            // 测试乘法
            result = client.invoke(
                "CalculatorService", 
                "multiply", 
                new Class[]{int.class, int.class}, 
                new Object[]{5, 6}
            );
            System.out.println("5 * 6 = " + result);
            
            // 测试除法
            result = client.invoke(
                "CalculatorService", 
                "divide", 
                new Class[]{double.class, double.class}, 
                new Object[]{10.0, 3.0}
            );
            System.out.println("10.0 / 3.0 = " + result);
            
        } catch (Exception e) {
            System.err.println("Client error: " + e.getMessage());
            e.printStackTrace();
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

## 高级 Socket 特性

### 超时控制

```java
// 带超时控制的 Socket 客户端
public class TimeoutSocketClient extends ObjectSocketClient {
    private int connectTimeout = 5000; // 5秒连接超时
    private int readTimeout = 10000;   // 10秒读取超时
    
    public TimeoutSocketClient(String host, int port) {
        super(host, port);
    }
    
    @Override
    public void connect() throws IOException {
        socket = new Socket();
        socket.connect(new InetSocketAddress(host, port), connectTimeout);
        socket.setSoTimeout(readTimeout);
        
        objectOutput = new ObjectOutputStream(socket.getOutputStream());
        objectInput = new ObjectInputStream(socket.getInputStream());
        connected = true;
        System.out.println("Connected to server: " + host + ":" + port);
    }
    
    // getter 和 setter 方法
    public int getConnectTimeout() { return connectTimeout; }
    public void setConnectTimeout(int connectTimeout) { this.connectTimeout = connectTimeout; }
    
    public int getReadTimeout() { return readTimeout; }
    public void setReadTimeout(int readTimeout) { this.readTimeout = readTimeout; }
}
```

### 连接池管理

```java
// Socket 连接池
public class SocketConnectionPool {
    private final String host;
    private final int port;
    private final int maxPoolSize;
    private final Queue<SocketConnection> availableConnections = new ConcurrentLinkedQueue<>();
    private final Set<SocketConnection> usedConnections = ConcurrentHashMap.newKeySet();
    private final AtomicInteger poolSize = new AtomicInteger(0);
    
    public SocketConnectionPool(String host, int port, int maxPoolSize) {
        this.host = host;
        this.port = port;
        this.maxPoolSize = maxPoolSize;
    }
    
    public SocketConnection borrowConnection() throws IOException {
        SocketConnection connection = availableConnections.poll();
        
        if (connection == null) {
            if (poolSize.get() < maxPoolSize) {
                connection = createNewConnection();
            } else {
                throw new RuntimeException("Connection pool exhausted");
            }
        } else if (!connection.isValid()) {
            // 连接无效，创建新的
            connection.close();
            connection = createNewConnection();
        }
        
        usedConnections.add(connection);
        return connection;
    }
    
    public void returnConnection(SocketConnection connection) {
        if (connection != null && connection.isValid()) {
            usedConnections.remove(connection);
            availableConnections.offer(connection);
        } else {
            usedConnections.remove(connection);
            poolSize.decrementAndGet();
            try {
                connection.close();
            } catch (IOException e) {
                System.err.println("Error closing connection: " + e.getMessage());
            }
        }
    }
    
    private SocketConnection createNewConnection() throws IOException {
        Socket socket = new Socket(host, port);
        SocketConnection connection = new SocketConnection(socket);
        poolSize.incrementAndGet();
        return connection;
    }
    
    public void close() {
        // 关闭所有连接
        for (SocketConnection conn : availableConnections) {
            try {
                conn.close();
            } catch (IOException e) {
                System.err.println("Error closing connection: " + e.getMessage());
            }
        }
        
        for (SocketConnection conn : usedConnections) {
            try {
                conn.close();
            } catch (IOException e) {
                System.err.println("Error closing connection: " + e.getMessage());
            }
        }
        
        availableConnections.clear();
        usedConnections.clear();
        poolSize.set(0);
    }
}

// Socket 连接封装
class SocketConnection {
    private final Socket socket;
    private final ObjectInputStream input;
    private final ObjectOutputStream output;
    private final long createTime;
    
    public SocketConnection(Socket socket) throws IOException {
        this.socket = socket;
        this.output = new ObjectOutputStream(socket.getOutputStream());
        this.input = new ObjectInputStream(socket.getInputStream());
        this.createTime = System.currentTimeMillis();
    }
    
    public RpcResponse sendRequest(RpcRequest request) throws IOException, ClassNotFoundException {
        output.writeObject(request);
        output.flush();
        return (RpcResponse) input.readObject();
    }
    
    public boolean isValid() {
        return socket != null && !socket.isClosed() && socket.isConnected();
    }
    
    public void close() throws IOException {
        if (input != null) input.close();
        if (output != null) output.close();
        if (socket != null) socket.close();
    }
    
    public Socket getSocket() {
        return socket;
    }
}
```

## 错误处理和日志

### 完善的错误处理

```java
// RPC 异常定义
public class RpcException extends Exception {
    public RpcException(String message) {
        super(message);
    }
    
    public RpcException(String message, Throwable cause) {
        super(message, cause);
    }
}

public class ConnectException extends RpcException {
    public ConnectException(String message) {
        super(message);
    }
    
    public ConnectException(String message, Throwable cause) {
        super(message, cause);
    }
}

public class TimeoutException extends RpcException {
    public TimeoutException(String message) {
        super(message);
    }
}

public class ServiceNotFoundException extends RpcException {
    public ServiceNotFoundException(String message) {
        super(message);
    }
}

// 带重试机制的客户端
public class RobustSocketClient extends TimeoutSocketClient {
    private int maxRetries = 3;
    
    public RobustSocketClient(String host, int port) {
        super(host, port);
    }
    
    public Object invokeWithRetry(String serviceName, String methodName, 
                                 Class<?>[] paramTypes, Object[] params) throws Exception {
        Exception lastException = null;
        
        for (int i = 0; i <= maxRetries; i++) {
            try {
                return invoke(serviceName, methodName, paramTypes, params);
            } catch (Exception e) {
                lastException = e;
                if (i < maxRetries) {
                    System.out.println("Attempt " + (i + 1) + " failed, retrying...");
                    // 等待后重试
                    try {
                        Thread.sleep(1000 * (i + 1));
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RpcException("Interrupted during retry", ie);
                    }
                    
                    // 重新连接
                    try {
                        disconnect();
                        connect();
                    } catch (IOException ioException) {
                        System.err.println("Failed to reconnect: " + ioException.getMessage());
                    }
                }
            }
        }
        
        throw new RpcException("RPC call failed after " + maxRetries + " retries", lastException);
    }
    
    // getter 和 setter 方法
    public int getMaxRetries() { return maxRetries; }
    public void setMaxRetries(int maxRetries) { this.maxRetries = maxRetries; }
}
```

## 总结

通过本章的学习，我们深入了解了如何使用 Socket 编程实现基本的远程调用功能。我们从简单的文本通信开始，逐步实现了基于对象的复杂数据传输，并添加了超时控制、连接池、错误处理等高级特性。

关键要点包括：

1. **Socket 基础**：理解 ServerSocket 和 Socket 的基本用法
2. **对象序列化**：掌握 Java 对象的序列化和反序列化
3. **请求-响应模式**：实现标准的 RPC 请求和响应机制
4. **服务注册**：构建服务注册和发现机制
5. **连接管理**：实现连接池和超时控制
6. **错误处理**：建立完善的异常处理机制

这些基础技术为后续实现完整的 RPC 框架奠定了坚实的基础。在实际应用中，我们还需要考虑更多高级特性，如负载均衡、服务发现、安全认证等，但这些核心的 Socket 编程技能是必不可少的。

在下一章中，我们将探讨如何使用 NIO（非阻塞 I/O）来进一步提升 RPC 框架的性能和并发处理能力。