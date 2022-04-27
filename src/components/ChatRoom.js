import React, { useEffect, useState } from 'react'
import { over } from 'stompjs';
import SockJS from 'sockjs-client';

var stompClient = null;
var usernames;
var onlineUsernames = [];
const ChatRoom = () => {
    const [privateChats, setPrivateChats] = useState(new Map());
    const [publicChats, setPublicChats] = useState([]);
    const [tab, setTab] = useState("CHATROOM");
    const [userData, setUserData] = useState({
        username: '',
        password: '',
        receivername: '',
        connected: false,
        message: '',
    });
    useEffect(() => {
        console.log(userData);
    }, [userData]);

    const connect = () => {
        let Sock = new SockJS('http://localhost:8080/ws');
        stompClient = over(Sock);
        stompClient.connect({}, onConnected, onError);
    }

    const onConnected = () => {
        var user = {
            username: userData.username,
            password: userData.password
        };
        stompClient.subscribe('/user/' + userData.username + '/client/registerOrLogin', onRegisterOrLogin);
        stompClient.subscribe('/user/' + userData.username + '/client/userList', onUserList);
        stompClient.subscribe('/user/' + userData.username + '/client/introduce', onIntroduce);
        stompClient.send('/app/registerOrLogin', {}, JSON.stringify(user));
        stompClient.send('/app/userList', {}, JSON.stringify(user));
    }
    const userJoin = () => {
        var chatMessage = {
            senderName: userData.username,
            status: "JOIN"
        };
        stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
    }
    const onIntroduce = (payload) => {
        var payloadData = JSON.parse(payload.body);
        if (payloadData.senderName !== userData.username) {
            onlineUsernames = payloadData.message;
            console.log("LAST " + onlineUsernames);
        }
    }
    const onRegisterOrLogin = (payload) => {
        var payloadData = JSON.parse(payload.body);
        if (payloadData.message === "true") {
            setUserData({ ...userData, "connected": true });
            stompClient.subscribe('/chatroom/public', onMessageReceived);
            stompClient.subscribe('/user/' + userData.username + '/private', onPrivateMessage);
            userJoin();
        } else {
            alert("Kullanıcı adı veya şifre yanlış.");
        }
    }

    const onUserList = (payload) => {
        var payloadData = JSON.parse(payload.body);
        console.log(payload.body);
        console.log(payloadData)
        usernames = (payloadData).map(function (item) {
            if (item.username !== userData.username) {
                privateChats.set(item.username, []);
            }

            return item.username;
        });
        console.log(usernames);
        console.log("setted");
    }

    const onMessageReceived = (payload) => {
        var payloadData = JSON.parse(payload.body);
        var chatMessage = {
            senderName: userData.username,
            receiverName: payloadData.senderName,
            message: onlineUsernames,
        };
        console.log("receiver name = " + payloadData.senderName);
        switch (payloadData.status) {
            case "JOIN":
                if (onlineUsernames.indexOf(payloadData.senderName) <= -1) {
                    onlineUsernames.push(payloadData.senderName);
                    console.log("ASDASDSDASD " + onlineUsernames);
                }
                stompClient.send('/app/introduce', {}, JSON.stringify(chatMessage));
                if (!privateChats.get(payloadData.senderName)) {
                    privateChats.set(payloadData.senderName, []);
                    setPrivateChats(new Map(privateChats));
                }
                break;
            case "MESSAGE":
                publicChats.push(payloadData);
                setPublicChats([...publicChats]);
                break;
            default:
                break;
        }
    }

    const onPrivateMessage = (payload) => {
        console.log(payload);
        var payloadData = JSON.parse(payload.body);
        if (privateChats.get(payloadData.senderName)) {
            privateChats.get(payloadData.senderName).push(payloadData);
            setPrivateChats(new Map(privateChats));
        } else {
            let list = [];
            list.push(payloadData);
            privateChats.set(payloadData.senderName, list);
            setPrivateChats(new Map(privateChats));
        }
    }

    const onError = (err) => {
        console.log(err);

    }

    const handleMessage = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "message": value });
    }
    const sendValue = () => {
        if (userData.message !== "" && userData.message.length < 255) {
            if (stompClient) {
                var chatMessage = {
                    senderName: userData.username,
                    message: userData.message,
                    status: "MESSAGE"
                };
                console.log(chatMessage);
                stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
                setUserData({ ...userData, "message": "" });
            }
        }else{
            alert("En az 1 en çok 255 karakterlik bir mesaj yollayabilirsin.")
        }

    }

    const exit = () => {
        var chatMessage = {
            senderName: userData.username,
            receiverName: "",
            message: onlineUsernames,
        };

        const index = onlineUsernames.indexOf(userData.username);
        if (index > -1) {
            onlineUsernames.splice(index, 1);
        }
        console.log("index dışı usernames = " + onlineUsernames);
        chatMessage.message = onlineUsernames;
        for (var i = 0; i < onlineUsernames.length; i++) {
            chatMessage.receiverName = onlineUsernames[i];
            stompClient.send('/app/introduce', {}, JSON.stringify(chatMessage));
            console.log(chatMessage);
        }
        stompClient.disconnect();
        window.location.reload(); // çarpıya basınca sayfaya refresh atılır ve kullanıcı çıkartılır.
    }

    const sendPrivateValue = () => {
        if (userData.message !== "" && userData.message.length < 255) {
            if (stompClient) {
                var chatMessage = {
                    senderName: userData.username,
                    receiverName: tab,
                    message: userData.message,
                    status: "MESSAGE",
                    received: "No"
                };
                console.log(chatMessage.senderName);
                const index = onlineUsernames.indexOf(chatMessage.receiverName);
                if (index > -1) {
                    chatMessage.received = "Yes";
                }
                console.log(chatMessage);
                if (userData.username !== tab) {
                    privateChats.get(tab).push(chatMessage);
                    setPrivateChats(new Map(privateChats));
                }
                stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));
                setUserData({ ...userData, "message": "" });
            }
        }else{
            alert("En az 1 en çok 255 karakterlik bir mesaj yollayabilirsin.")
        }
    }
    const handleUsername = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "username": value });
    }

    const handlePassword = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "password": value });
    }

    const registerUser = () => {

        connect();
    }
    return (
        <div className="container">
            {userData.connected ?
                <div className="chat-box">
                    <div className="buttons">
                        <button type="button" className="exit-button" onClick={exit}>x</button>
                        <button type="button" className="create-group" onClick={exit}>+</button>
                    </div>
                    <div className="member-list">
                        <ul>
                            <li onClick={() => { setTab("CHATROOM") }} className={`member ${tab === "CHATROOM" && "active"}`}>Chatroom</li>
                            {[...privateChats.keys()].map((name, index) => (
                                <li onClick={() => { setTab(name) }} className={`member ${tab === name && "active"}`} key={index}>{name}</li>
                            ))}
                        </ul>
                    </div>

                    {tab === "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {publicChats.map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="enter the message" value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendValue}>Send</button>
                        </div>
                    </div>}
                    {tab !== "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {[...privateChats.get(tab)].map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="enter the message" value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendPrivateValue}>Send</button>
                        </div>
                    </div>}
                </div>
                :
                <div className="register">
                    <form>

                        <div className="registerInput">
                            <input
                                type="text"
                                id="user-name"
                                placeholder="Enter your username"
                                name="userName"
                                value={userData.username}
                                onChange={handleUsername}
                                margin="normal"
                            />
                        </div>
                        <div className="registerInput">
                            <input
                                type="password"
                                id="password"
                                placeholder="Enter your password"
                                name="password"
                                value={userData.password}
                                onChange={handlePassword}
                                margin="normal"
                            />
                        </div>
                        <div className="registerInput">
                            <button type="button" onClick={registerUser}>
                                connect
                            </button>
                        </div>
                    </form>
                </div>}
        </div>
    )
}

export default ChatRoom