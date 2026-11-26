// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"io"
	"os"
	"syscall"
)

const goos = "windows"

// Pipe names are shared by everyone on a Windows machine, so whoever serves `discord-ipc-0` may not be Discord.
// By default the server of a pipe may act as the client that opened it, with all the client's rights. These
// flags limit it to learning who connected (SECURITY_SQOS_PRESENT | SecurityIdentification << 16), which is
// all Discord needs.
const pipeSecurity = 0x00100000 | 1<<16

// A named pipe can be opened like a file, with the flags above; the standard library's syscall package is
// enough, so no extra module is used.
func dialIPC(path string) (io.ReadWriteCloser, error) {
	name, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return nil, err
	}
	h, err := syscall.CreateFile(name, syscall.GENERIC_READ|syscall.GENERIC_WRITE, 0, nil,
		syscall.OPEN_EXISTING, pipeSecurity, 0)
	if err != nil {
		return nil, &os.PathError{Op: "open", Path: path, Err: err}
	}
	return &pipe{os.NewFile(uintptr(h), path), h}, nil
}

// pipe is Discord's pipe. Closing it first cancels any read or write still waiting on it (CancelIoEx), so that
// a server that never answers cannot leave one blocked, with its handle, every time the bridge gives up on it.
type pipe struct {
	*os.File
	h syscall.Handle
}

func (p *pipe) Close() error {
	syscall.CancelIoEx(p.h, nil)
	return p.File.Close()
}

// privateDir is only needed where the claim file is written, which is Linux.
func privateDir(string) bool { return false }
