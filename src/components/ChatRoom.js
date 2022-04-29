import React, { useEffect, useState } from 'react'
import { over } from 'stompjs';
import SockJS from 'sockjs-client';

var stompClient = null;
var usernames;
var onlineUsernames = [];
var groupChatJoinStatus = false;
const ChatRoom = () => {
    const [privateChats, setPrivateChats] = useState(new Map());
    const [publicChats, setPublicChats] = useState([]);
    const [groupChats, setGroupChats] = useState([]);
    const [tab, setTab] = useState("CHATROOM");
    const [visible, setVisible] = useState(false);
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
        stompClient.subscribe('/user/' + userData.username + '/client/addUserToGroupChat', onAddUserToGroupChat);
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

    const onAddUserToGroupChat = (payload) => {

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
            stompClient.subscribe('/chatroom/group', onMessageReceived);
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
        switch (payloadData.status) {
            case "JOIN":
                if (onlineUsernames.indexOf(payloadData.senderName) <= -1) {
                    onlineUsernames.push(payloadData.senderName);
                }
                if(payloadData.senderName === userData.username){
                    if(payloadData.message === "true"){
                        setVisible(true);
                    }else{
                        setVisible(false);
                    }
                }
                    
                
                stompClient.send('/app/introduce', {}, JSON.stringify(chatMessage));
                if (!privateChats.get(payloadData.senderName)) {
                    privateChats.set(payloadData.senderName, []);
                    privateChats.delete(userData.username);
                    setPrivateChats(new Map(privateChats));
                }
                break;
            case "MESSAGE":
                publicChats.push(payloadData);
                setPublicChats([...publicChats]);
                break;
            case "GROUP_MESSAGE":
                if(groupChatJoinStatus){
                    groupChats.push(payloadData);
                    setGroupChats([...groupChats]);
                }
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
        } else {
            alert("En az 1 en çok 255 karakterlik bir mesaj yollayabilirsin.")
        }

    }
    const sendGroupValue = () => {
        if (userData.message !== "" && userData.message.length < 255) {
            if (stompClient) {
                var chatMessage = {
                    senderName: userData.username,
                    message: userData.message,
                    status: "GROUP_MESSAGE"
                };
                console.log(chatMessage);
                stompClient.send("/app/groupMessage", {}, JSON.stringify(chatMessage));
                setUserData({ ...userData, "message": "" });
            }
        } else {
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
        } else {
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
        if(userData.username.length > 15 ){
            alert("Kullanıcı adı maksimum 15 karakter olabilir!");
        }else if(userData.password.length > 15){
            alert("Şifre maksimum 15 karakter olabilir!");
        }else{
            connect();
        }
    }

    /*
        <ul>
                 {[...privateChats.keys()].map((name, index) => (
                     <li id={name} onClick={() => { addUserToGroup(name, index) }} className="groupUsersButton" key={index}>{"+ " + name}</li>
                ))}
            </ul>
               <ul>
                 {[...groupChats.keys()].map((name, index) => (
                  <li id={"group" + name} onClick={() => { removeUserFromGroup(name, index) }} className="groupUsersButton" key={index}>{"- " + name}</li>
                 ))}
            </ul>
        
        let joinButton = document.getElementById("join-group-button");
        joinButton.setAttribute("hidden", "hidden");
        let exitButton = document.getElementById("exit-group-button");
        console.log(exitButton);
        exitButton.removeAttribute();



        remove => let element = document.getElementById(name);
        element.removeAttribute("hidden");
        groupChats.delete(name, index);
        setGroupChats(new Map(groupChats));
        console.log("SİLME: " + groupChats);
        */
    const addUserToGroup = (name, index) => {
        groupChatJoinStatus = true;
        setVisible(true);
    }
    const removeUserFromGroup = (name, index) => {
        groupChatJoinStatus = false;
        setVisible(false);
    }
    return (
        <div className="container">
            {userData.connected ?
                <div className="chat-box">
                    <div className="buttons">
                        <button type="button" className="exit-button" onClick={exit}>x</button>
                    </div>
                    <div className="member-list">
                        <h4>Merhaba {userData.username}</h4>
                        <ul>
                            <li onClick={() => { setTab("CHATROOM") }} className={`member ${tab === "CHATROOM" && "active"}`}>Herkese Açık Chat</li>
                            {[...privateChats.keys()].map((name, index) => (
                                <li onClick={() => { setTab(name) }} className={`member ${tab === name && "active"}`} key={index}>{name}</li>
                            ))}
                            <li onClick={() => { setTab("GROUP") }} className={`member ${tab === "GROUP" && "active"}`}>Grup Chat</li>
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
                            <input type="text" className="input-message" placeholder="Mesajınızı giriniz." value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendValue}>gönder</button>
                        </div>
                    </div>}

                    {tab === "GROUP" && <div className="chat-content">
                    <div className="buttons">
                            {!visible && <button id="join-group-button" type="button" className="join-group-button" onClick={addUserToGroup}>Gruba Katıl</button>}
                            {visible && <button id="exit-group-button" type="button" className="exit-group-button" onClick={removeUserFromGroup} >Gruptan Ayrıl</button>}         
                        </div>
                        <ul className="chat-messages">
                            {groupChats.map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">{chat.message}</div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            {visible &&<input type="text" className="input-message" placeholder="Mesajınızı giriniz." value={userData.message} onChange={handleMessage} />}
                            {visible && <button type="button" className="send-button" onClick={sendGroupValue}>gönder</button>}
                            {!visible && <h3>Mesaj göndermek ve görüntülemek için gruba katılmanız gerekiyor!</h3>}
                        </div>
                        

                    </div>}

                    {(tab !== "CHATROOM" && tab !== "GROUP") && <div className="chat-content">
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
                            <input type="text" className="input-message" placeholder="Mesajınızı giriniz." value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendPrivateValue}>gönder</button>
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